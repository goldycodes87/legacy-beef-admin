import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AGENT_TOOLS, WRITE_TOOLS, executeTool, logAgentAction } from '@/lib/agent-tools';

/**
 * The employee's brain, shared by every channel — the Ask tab, SMS, and the
 * Vapi voice line all call runAgentTurn() and read/write the same
 * conversation, memory, and pending-approval queue. Modeled on the Clozr
 * coaches: persona and memory live in the database and ride in the system
 * prompt; history is persisted server-side and replayed.
 *
 * Writes never execute inside a turn. The loop parks them in
 * agent_pending_actions and each channel presents them its own way (approval
 * card on web, "reply YES" over SMS, spoken hand-off on voice). decideAction()
 * is the single place an approval or refusal is carried out.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
export type Channel = 'web' | 'sms' | 'voice';

type Blocks = Anthropic.ContentBlockParam[];

interface AgentTurnResult {
  reply: string;
  pending: { id: string; tool: string; input: Record<string, unknown> } | null;
}

function baseSystem(name: string, memory: string | null, extra: string | null): string {
  return `You are ${name}, the ranch hand and operations manager for Legacy Land & Cattle, a family ranch in Black Forest, Colorado selling whole, half, and quarter beef shares. You work for Grant — he is the only person you ever talk to. You are a trusted employee: warm, plainspoken, a little cowboy, and completely precise about money and dates.

How the business works: customers reserve a share of an animal on a butcher date and pay a deposit (card immediately, or cash/check that Grant marks received — until then their cut sheet is held). They fill out a cut sheet (quarter buyers get the house sheet). Animals are processed at T-K Processing in Cañon City, beef is priced on hanging weight, customers pay the balance and pick up at the ranch. One animal = 1 unit; a half is 0.5, a quarter 0.25.

Rules:
- Answer from tool data, never from memory or guesswork. Quote real names, dollars, and dates.
- Lead with the answer. Grant is usually on his phone.
- "Banked" money is net of card surcharges; $0 banked means unpaid regardless of status.
- Anything that changes data goes to Grant for approval — propose it with exact parameters, then call the tool; the system will route the approval.
- If you have no tool for something, say so and name the manual path in the admin.
- An empty email log more likely means the Resend webhook isn't configured than that no email was sent.${
    memory ? `\n\nTHINGS YOU REMEMBER (from prior conversations — verify anything time-sensitive with tools):\n${memory}` : ''
  }${extra ? `\n\nSTANDING INSTRUCTIONS FROM GRANT:\n${extra}` : ''}`;
}

const CHANNEL_NOTE: Record<Channel, string> = {
  web: '',
  sms: '\n\nCHANNEL: SMS. Keep replies under 450 characters, plain text, no markdown. One message, no lists unless tiny.',
  voice:
    '\n\nCHANNEL: Voice call. You are being read aloud. Short conversational sentences, no markdown, no lists — say numbers naturally.',
};

async function loadContext() {
  const supabase = getSupabaseAdmin();
  const [{ data: config }, { data: memory }, { data: rows }] = await Promise.all([
    supabase.from('agent_config').select('name, extra_prompt').eq('id', 1).maybeSingle(),
    supabase.from('agent_memory').select('memory_text').eq('id', 1).maybeSingle(),
    supabase
      .from('agent_messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const history = (rows || []).reverse();
  // Replay must not start mid-tool-exchange: drop leading rows until a user
  // turn whose first block is plain text.
  let start = 0;
  for (let i = 0; i < history.length; i++) {
    const c = history[i].content as Array<{ type?: string }>;
    if (history[i].role === 'user' && Array.isArray(c) && c[0]?.type === 'text') {
      start = i;
      break;
    }
    if (i === history.length - 1) start = history.length;
  }

  const messages: Anthropic.MessageParam[] = history.slice(start).map((r) => ({
    role: r.role as 'user' | 'assistant',
    content: r.content as Blocks,
  }));

  return {
    name: config?.name || 'Rusty',
    extra: config?.extra_prompt || null,
    memory: memory?.memory_text || null,
    messages,
  };
}

async function saveMessage(channel: Channel, role: 'user' | 'assistant', content: Blocks) {
  await getSupabaseAdmin().from('agent_messages').insert({ channel, role, content });
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Runs one full agent turn: appends the user text (or a tool_result from a
 * decided approval), loops tools, parks the first write as a pending action.
 */
export async function runAgentTurn(
  channel: Channel,
  userText: string | null,
  resumeToolResult?: { tool_use_id: string; result: Record<string, unknown> }
): Promise<AgentTurnResult> {
  const client = new Anthropic();
  const ctx = await loadContext();
  const messages = ctx.messages;

  if (userText) {
    const block: Blocks = [{ type: 'text', text: userText }];
    messages.push({ role: 'user', content: block });
    await saveMessage(channel, 'user', block);
  }
  if (resumeToolResult) {
    const block: Blocks = [
      {
        type: 'tool_result',
        tool_use_id: resumeToolResult.tool_use_id,
        content: JSON.stringify(resumeToolResult.result),
      },
    ];
    messages.push({ role: 'user', content: block });
    await saveMessage(channel, 'user', block);
  }

  const system = baseSystem(ctx.name, ctx.memory, ctx.extra) + CHANNEL_NOTE[channel];

  for (let turn = 0; turn < 12; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: AGENT_TOOLS,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { reply: "I can't help with that one.", pending: null };
    }

    messages.push({ role: 'assistant', content: response.content });
    await saveMessage(channel, 'assistant', response.content as Blocks);

    if (response.stop_reason === 'pause_turn') continue;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { reply: textOf(response.content), pending: null };
    }

    const write = toolUses.find((t) => WRITE_TOOLS.has(t.name));
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const t of toolUses) {
      if (write && t.id === write.id) continue;
      const r = await executeTool(t.name, t.input);
      results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(r) });
    }

    if (write) {
      // Park it. Sibling read results are stored on the pending row so the
      // decision — from any channel — can complete the turn correctly.
      const supabase = getSupabaseAdmin();
      const { data: pendingRow, error } = await supabase
        .from('agent_pending_actions')
        .insert({
          tool_use_id: write.id,
          tool: write.name,
          input: { args: write.input, sibling_results: results },
          channel,
        })
        .select('id')
        .single();
      if (error || !pendingRow) {
        return { reply: 'I could not queue that action for approval — try again.', pending: null };
      }
      const preText = textOf(response.content);
      return {
        reply: preText,
        pending: {
          id: pendingRow.id,
          tool: write.name,
          input: write.input as Record<string, unknown>,
        },
      };
    }

    messages.push({ role: 'user', content: results });
    await saveMessage(channel, 'user', results);
  }

  return { reply: 'I hit my step limit — ask me to keep going.', pending: null };
}

/** The oldest still-pending action, if any. */
export async function getPendingAction() {
  const { data } = await getSupabaseAdmin()
    .from('agent_pending_actions')
    .select('id, tool_use_id, tool, input, channel, created_at')
    .eq('status', 'pending')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const stored = (data.input as { args?: Record<string, unknown> }) || {};
  return { ...data, args: stored.args || {} };
}

/**
 * Executes or declines a parked write, then resumes the conversation so the
 * agent can report the outcome. Single path for web taps and SMS YES/NO.
 */
export async function decideAction(
  id: string,
  approved: boolean,
  channel: Channel
): Promise<AgentTurnResult> {
  const supabase = getSupabaseAdmin();
  const { data: action } = await supabase
    .from('agent_pending_actions')
    .select('id, tool_use_id, tool, input, status')
    .eq('id', id)
    .maybeSingle();

  if (!action || action.status !== 'pending') {
    return { reply: 'That action is no longer pending.', pending: null };
  }

  const stored = (action.input as {
    args?: Record<string, unknown>;
    sibling_results?: Anthropic.ToolResultBlockParam[];
  }) || {};

  let result: Record<string, unknown>;
  if (approved && WRITE_TOOLS.has(action.tool)) {
    result = await executeTool(action.tool, stored.args || {});
    await logAgentAction(action.tool, stored.args || {}, result);
  } else {
    result = { declined: true, note: 'Grant declined this action. Do not retry it unasked.' };
  }

  await supabase
    .from('agent_pending_actions')
    .update({ status: approved ? 'approved' : 'declined', decided_at: new Date().toISOString() })
    .eq('id', action.id);

  // Sibling reads from the paused turn ride along in the same user message.
  const siblings = stored.sibling_results || [];
  const supabaseSave: Blocks = [
    ...siblings,
    {
      type: 'tool_result',
      tool_use_id: action.tool_use_id,
      content: JSON.stringify(result),
    },
  ];
  // decideAction resumes with the combined tool_result turn instead of text.
  const ctxTurn = await runAgentTurnWithBlocks(channel, supabaseSave);
  return ctxTurn;
}

/** Resume helper: append a prepared user block set and continue the loop. */
async function runAgentTurnWithBlocks(channel: Channel, blocks: Blocks): Promise<AgentTurnResult> {
  await saveMessage(channel, 'user', blocks);
  return runAgentTurn(channel, null);
}

/**
 * Clozr-style memory extraction: distill durable facts from the recent
 * transcript into agent_memory. Fire-and-forget; failures are irrelevant.
 */
export async function refreshAgentMemory(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from('agent_messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .limit(60);
    if (!rows || rows.length < 6) return;

    const transcript = rows
      .reverse()
      .map((r) => {
        const c = r.content as Array<{ type?: string; text?: string }>;
        const text = Array.isArray(c)
          ? c.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join(' ')
          : '';
        return text ? `${r.role}: ${text}` : null;
      })
      .filter(Boolean)
      .join('\n');
    if (!transcript) return;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system:
        'Extract durable facts an operations assistant for a beef ranch should remember about its owner Grant and the business, from this transcript: preferences, standing decisions, recurring concerns, names and context worth keeping. Short bullet points, max 15. Specific and factual. Omit anything time-sensitive that tools should answer instead (current capacity, balances).',
      messages: [{ role: 'user', content: transcript.slice(-12000) }],
    });
    const memoryText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    if (!memoryText) return;

    await supabase
      .from('agent_memory')
      .update({ memory_text: memoryText, updated_at: new Date().toISOString() })
      .eq('id', 1);
  } catch (err) {
    console.error('Memory refresh failed:', err);
  }
}
