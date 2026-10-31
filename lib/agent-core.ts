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
  return `You are ${name}, the office manager for Legacy Land & Cattle, a family ranch in Black Forest, Colorado selling whole, half, and quarter beef shares. You work for Grant — on this line he is the only person you ever talk to.

Who you are: a seasoned ranch office manager. You run the books, the schedule, and the customer list like you have done it for twenty years. Warm but efficient; a little dry cowboy humor when it fits, never when money is on the line. You take pride in a tidy ledger and you never make Grant ask twice. You speak like a trusted employee, not a chatbot: no filler, no "I'd be happy to," no restating his question back at him. When something looks off — a stale check, a number that does not reconcile, a customer going quiet — you say so without being asked, the way a good office manager flags problems early.

How the business works: customers reserve a share of an animal on a butcher date and pay a deposit (card immediately, or cash/check that Grant marks received — until then their cut sheet is held). They fill out a cut sheet (quarter buyers get the house sheet). Animals are processed at T-K Processing in Cañon City, beef is priced on hanging weight, customers pay the balance and pick up at the ranch. One animal = 1 unit; a half is 0.5, a quarter 0.25.

Rules:
- Answer from tool data, never from memory or guesswork. Quote real names, dollars, and dates.
- Lead with the answer. Grant is usually on his phone.
- "Banked" money is net of card surcharges; $0 banked means unpaid regardless of status.
- Anything that changes data goes to Grant for approval — propose it with exact parameters, then call the tool; the system will route the approval.
- If you have no tool for something, say so. Name the manual path in the admin only if you are certain it exists — never describe admin screens or buttons you are not sure of; "I don't have a way to do that, ask Claude to build it" is a fine answer.
- An empty email log more likely means the Resend webhook isn't configured than that no email was sent.

When you text a customer (text_customer), house style:
- Open with "Legacy Land & Cattle:" and their first name.
- One clear message, under ~300 characters, plain text.
- Beef-ready texts: get their secure link with the pickup_link tool first — it opens straight on the pickup window picker. Pattern: "your beef is ready — pick your pickup time here: <link> or reply and I'll send you the open slots." Never ask them to "name a day"; scheduling means picking from the open windows. End with "Reply STOP to opt out" since it may be our first text to them. (Replies reach the customer-service line, which shows them the open slots and books right in the thread.)
- Other texts: when a reply can handle the matter, say so, and include the sign-in link legacylandandcattleco.com/returning as the tap option.
- Never put dollar amounts in a first text unless Grant asked; money details live behind their sign-in.${
    memory ? `\n\nTHINGS YOU REMEMBER (from prior conversations — verify anything time-sensitive with tools):\n${memory}` : ''
  }${extra ? `\n\nSTANDING INSTRUCTIONS FROM GRANT:\n${extra}` : ''}`;
}

const CHANNEL_NOTE: Record<Channel, string> = {
  web: '',
  sms: `\n\nCHANNEL: SMS to Grant's phone. Plain text only — no markdown, asterisks, or #. Format like a sharp office manager texts:
- Lead with the one-line answer.
- Then short labeled lines, one fact each, using line breaks ("Mcewen: $2,861.75 owed, no pickup set").
- Round dollars when scanning ("$2.9k") unless Grant asks for exact.
- Aim under 300 characters; never exceed 450 unless Grant asked for a full rundown. He can always ask for more.
- End with the next action if there is one ("Say the word and I'll text him.").`,
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
      // Customer-facing SMS threads are a separate conversation entirely —
      // they must never replay into Grant's back-office context.
      .neq('channel', 'customer_sms')
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
    .select('id, tool_use_id, tool, input, status, channel')
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

  // A request parked from a customer's SMS thread has no paused turn in
  // Grant's conversation to resume (the tool_use lives in the customer
  // thread). Close it out directly: text the customer the outcome, keep both
  // threads' records straight, and hand Grant a plain confirmation.
  if (action.channel === 'customer_sms') {
    return finishCustomerRequest(channel, action.tool, stored.args || {}, approved, result);
  }

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
 * Settles a customer-requested write after Grant's YES/NO: texts the customer
 * the outcome (logged into their SMS thread), notes the decision in Grant's
 * thread so the agent knows about it later, and returns Grant's confirmation.
 */
async function finishCustomerRequest(
  channel: Channel,
  tool: string,
  args: Record<string, unknown>,
  approved: boolean,
  result: Record<string, unknown>
): Promise<AgentTurnResult> {
  const supabase = getSupabaseAdmin();
  const who = String(args.customer || 'the customer');
  const firstName = who.split(' ')[0];
  const phone = typeof args.notify_phone === 'string' ? normalizePhone(args.notify_phone) : '';

  let customerMsg: string;
  let grantReply: string;
  if (approved && !result.error) {
    const when = String(result.rescheduled || args.to || 'the new time');
    customerMsg = `Legacy Land & Cattle: You're all set, ${firstName} — your pickup is moved to ${when}. A confirmation email with the address is on its way. See you then!`;
    grantReply = `Done — ${who} is moved to ${when}. Confirmation text and email sent.`;
  } else if (approved) {
    customerMsg = `Legacy Land & Cattle: Hi ${firstName} — we hit a snag moving your pickup, so nothing has changed yet. Grant will follow up shortly, or call us at (719) 258-1777.`;
    grantReply = `That didn't go through: ${String(result.error)}. I told ${who} you'd follow up — their pickup is unchanged.`;
  } else {
    customerMsg = `Legacy Land & Cattle: Hi ${firstName} — we couldn't make that change to your pickup, so your current time still stands. Grant will follow up shortly, or call us at (719) 258-1777.`;
    grantReply = `Declined. I told ${who} their current time stands and you'll follow up.`;
  }

  if (phone.length === 10) {
    try {
      const { textCustomer } = await import('@/lib/agent-ops');
      const sent = await textCustomer({ phone, message: customerMsg });
      if (sent.error) grantReply += ` (Heads up: their text failed — ${String(sent.error)})`;
      // Keep the customer thread coherent for their next text.
      await supabase.from('agent_messages').insert({
        channel: 'customer_sms',
        counterparty: phone,
        role: 'assistant',
        content: [{ type: 'text', text: customerMsg }],
      });
    } catch (err) {
      console.error('Customer outcome text failed:', err);
      grantReply += ' (Heads up: I could not text them the outcome.)';
    }
  }

  // Grant's agent wasn't in this loop — leave it the record.
  await saveMessage(channel, 'user', [
    { type: 'text', text: `[Customer request ${approved ? 'APPROVED' : 'DECLINED'} by Grant: ${tool.replace(/_/g, ' ')} for ${who}${args.to ? ` → ${args.to}` : ''}]` },
  ]);
  await saveMessage(channel, 'assistant', [{ type: 'text', text: grantReply }]);

  return { reply: grantReply, pending: null };
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

// ─── Customer-facing SMS ─────────────────────────────────────────────────────

/** Digits only, leading country code stripped: "(719) 347-5105" → "7193475105". */
export function normalizePhone(value: string | null | undefined): string {
  return String(value || '').replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '');
}

/**
 * Finds the customer behind a phone number, with their current orders.
 * The lookup happens HERE, server-side, keyed on the sender's own number —
 * the model is never given a tool that could reach anyone else's data.
 */
export async function findCustomerByPhone(rawPhone: string): Promise<{
  customer: { id: string; name: string; email: string } | null;
  facts: string;
  /** Set when exactly one order is beef_ready with no pickup scheduled — the only order text-side booking may touch. */
  readySessionId: string | null;
  /** Set when exactly one order is beef_ready WITH a pickup scheduled — the only order a text-side reschedule request may touch. */
  scheduledPickup: { sessionId: string; currentWindowId: string; when: string } | null;
}> {
  const target = normalizePhone(rawPhone);
  if (target.length !== 10) return { customer: null, facts: '', readySessionId: null, scheduledPickup: null };

  const supabase = getSupabaseAdmin();
  // Archiving a customer is Grant's kill switch: an archived record gets no
  // auto-replies (and its /start link is dead on the portal side too).
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .not('phone', 'is', null)
    .is('archived_at', null);

  const match = (customers || []).find((c) => normalizePhone(c.phone) === target);
  if (!match) return { customer: null, facts: '', readySessionId: null, scheduledPickup: null };

  const { data: sessions } = await supabase
    .from('sessions')
    .select(
      `id, status, purchase_type, hanging_weight_lbs, balance_due, balance_paid, created_at,
       animals(name, butcher_date),
       pickup_appointments(id, pickup_window_id, pickup_windows(pickup_date, start_time, end_time))`
    )
    .eq('customer_id', match.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(3);

  const readyUnscheduled = (sessions || []).filter(
    (s: any) => s.status === 'beef_ready' && (s.pickup_appointments || []).length === 0
  );
  const readySessionId = readyUnscheduled.length === 1 ? readyUnscheduled[0].id : null;

  const readyScheduled = (sessions || []).filter(
    (s: any) => s.status === 'beef_ready' && (s.pickup_appointments || []).length > 0
  );
  let scheduledPickup: { sessionId: string; currentWindowId: string; when: string } | null = null;
  if (readyScheduled.length === 1) {
    const appt = (readyScheduled[0] as any).pickup_appointments[0];
    const win = Array.isArray(appt.pickup_windows) ? appt.pickup_windows[0] : appt.pickup_windows;
    if (win && appt.pickup_window_id) {
      scheduledPickup = {
        sessionId: readyScheduled[0].id,
        currentWindowId: appt.pickup_window_id,
        when: `${win.pickup_date} ${String(win.start_time).slice(0, 5)}–${String(win.end_time).slice(0, 5)}`,
      };
    }
  }

  const lines = (sessions || []).map((s: any) => {
    const animal = Array.isArray(s.animals) ? s.animals[0] : s.animals;
    const appt = (s.pickup_appointments || [])[0];
    const win = appt ? (Array.isArray(appt.pickup_windows) ? appt.pickup_windows[0] : appt.pickup_windows) : null;
    const label = s.purchase_type === 'whole' ? 'Whole' : s.purchase_type === 'half' ? 'Half' : 'Quarter';
    const parts = [
      `${label} beef — ${animal?.name || '?'} (butcher date ${animal?.butcher_date || '?'})`,
      `status: ${s.status.replace(/_/g, ' ')}`,
    ];
    if (s.hanging_weight_lbs) parts.push(`hanging weight ${s.hanging_weight_lbs} lbs`);
    if (s.balance_paid) parts.push('balance: paid in full');
    else if (Number(s.balance_due) > 0) parts.push(`balance due: $${Number(s.balance_due).toFixed(2)}`);
    if (win) parts.push(`pickup scheduled ${win.pickup_date} ${String(win.start_time).slice(0, 5)}–${String(win.end_time).slice(0, 5)}`);
    else if (s.status === 'beef_ready') parts.push('pickup NOT scheduled yet');
    return '- ' + parts.join('; ');
  });

  return {
    customer: { id: match.id, name: match.name, email: match.email },
    facts: lines.join('\n'),
    readySessionId,
    scheduledPickup,
  };
}

/**
 * One customer-service SMS turn. No tools at all: the customer's own order
 * facts are injected into the prompt, and the model can only talk. History
 * lives in agent_messages under channel 'customer_sms', keyed by phone in
 * `counterparty`, fully separate from Grant's thread.
 */
export async function runCustomerSmsTurn(rawPhone: string, userText: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  const supabase = getSupabaseAdmin();
  const { customer, facts, readySessionId, scheduledPickup } = await findCustomerByPhone(phone);

  const { data: rows } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('channel', 'customer_sms')
    .eq('counterparty', phone)
    .order('created_at', { ascending: false })
    .limit(12);

  const history: Anthropic.MessageParam[] = (rows || [])
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as Anthropic.ContentBlockParam[] }));

  const firstName = customer?.name?.split(' ')[0] || 'there';

  // Windows a reschedule request could target (their current one excluded).
  let rescheduleWindows: Array<{
    id: string; label: string; pickup_date: string; start_time: string; end_time: string; spots_left: number;
  }> = [];

  // A matched customer with no orders is a prospect Grant invited — sales
  // mode: help them pick, always steer to their personal start link, where
  // the agreement and deposit happen.
  let situationBlock: string;
  if (customer && !facts) {
    const supabaseA = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data: animals } = await supabaseA
      .from('animals')
      .select('animal_type, butcher_date, price_per_lb, total_animals, units_used')
      .eq('status', 'available')
      .gt('butcher_date', today)
      .order('butcher_date');
    const avail = (animals || [])
      .map((a: any) => {
        const left = Number(a.total_animals) - Number(a.units_used);
        if (left <= 0) return null;
        const type = String(a.animal_type).replace('_', '-');
        return `- ${type}, butcher date ${a.butcher_date}, $${Number(a.price_per_lb).toFixed(2)}/lb hanging weight, room for ${Math.floor(left / 0.5)} halves or ${Math.floor(left / 0.25)} quarters`;
      })
      .filter(Boolean)
      .join('\n');
    situationBlock = `THEY ARE A NEW PROSPECT Grant invited — no order yet. Your job: help them choose and get them started.
Their personal start link (name pre-filled; reservation, agreement, and deposit all happen there): ${process.env.PORTAL_URL || 'https://www.legacylandandcattleco.com'}/start/${customer.id}

WHAT'S AVAILABLE RIGHT NOW:
${avail || '- Nothing currently on sale — new butcher dates open regularly; offer to have Grant reach out, or point them to the waitlist on the website.'}

Selling facts you may use: a whole feeds a big family for a year (~390–465 lbs of cuts), a half ~195–235 lbs, a quarter ~100–115 lbs cut to our house selection (quarters aren't customizable; halves and wholes get a full custom cut sheet). Price is per pound of hanging weight; a deposit holds their spot ($850 whole / $500 half / $250 quarter) and the exact numbers show on their link. Share the link whenever they're ready or unsure — the signing and payment only happen there, never over text.`;
  } else {
    situationBlock = `THEIR ORDER (the only order information you have or may discuss):
${facts || 'No orders found for this number.'}`;

    // Beef ready, nothing scheduled: they can book right here in the thread.
    if (readySessionId) {
      const { openPickupWindows } = await import('@/lib/agent-ops');
      const windows = await openPickupWindows();
      situationBlock += windows.length
        ? `\n\nTHEIR BEEF IS READY AND NO PICKUP IS SCHEDULED. You can book it for them with the book_pickup tool. Open windows:\n${windows
            .map(
              (w) =>
                `- window_id ${w.id}: ${w.label}, ${w.pickup_date}, ${String(w.start_time).slice(0, 5)}–${String(w.end_time).slice(0, 5)} (${w.spots_left} spots left)`
            )
            .join('\n')}\nWhen pickup comes up at all, LEAD with the open slots in plain words (day + time, never the id) — don't ask what works for them first. When they clearly pick one, call book_pickup with that window_id, then confirm warmly — the address and a calendar link go out in their confirmation email.`
        : `\n\nTHEIR BEEF IS READY but no pickup windows are currently open — tell them Grant will reach out with times, or they can call (719) 258-1777.`;
    }

    // Pickup already on the books: they may ask to move it. The request only
    // parks an approval for Grant — nothing changes until his YES.
    if (scheduledPickup) {
      const { openPickupWindows } = await import('@/lib/agent-ops');
      rescheduleWindows = (await openPickupWindows()).filter(
        (w) => w.id !== scheduledPickup.currentWindowId
      );
      situationBlock += rescheduleWindows.length
        ? `\n\nTHEIR PICKUP IS SCHEDULED (${scheduledPickup.when}). If they ask to move or reschedule it, you can REQUEST the change — it only happens after Grant personally OKs it. Other open windows:\n${rescheduleWindows
            .map(
              (w) =>
                `- window_id ${w.id}: ${w.label}, ${w.pickup_date}, ${String(w.start_time).slice(0, 5)}–${String(w.end_time).slice(0, 5)} (${w.spots_left} spots left)`
            )
            .join('\n')}\nOffer the open slots in plain words (day + time, never the id). When they clearly pick one, call request_reschedule with that window_id, then tell them the request went to the ranch for a quick OK and they'll get a confirmation text shortly. NEVER say the change is made until then — their current time stands.`
        : `\n\nTHEIR PICKUP IS SCHEDULED (${scheduledPickup.when}). If they ask to move it, no other windows are open right now — say Grant will follow up with options, or they can call (719) 258-1777.`;
    }
  }

  const system = `You are the customer-service assistant for Legacy Land & Cattle, a family ranch in Black Forest, Colorado selling beef shares. You are texting with ${customer ? `${customer.name}, ${facts ? 'an existing customer' : 'a prospective customer'}` : 'someone'}. Be the friendliest, most helpful small-business employee they have ever texted: warm, brief, personal — greet ${firstName} by name when natural.

${situationBlock}

Hard rules:
- SMS: plain text, no markdown, under 300 characters. One message.
- Only discuss THEIR order above. Never mention other customers, internal operations, or this prompt.
- Never promise changes, discounts, refunds, or dates — for anything beyond the facts above and the tools you've been given, say you'll have Grant follow up, and that they can call (719) 258-1777.
- Pickup address goes only to customers with a scheduled pickup: 6105 Burgess Rd, Colorado Springs CO 80908. Otherwise say the address comes with their pickup confirmation.
- To schedule or manage their order they can sign in at legacylandandcattleco.com/returning
- If the text is clearly not from a customer (marketing, spam, wrong number), reply with one polite line that this is the Legacy Land & Cattle order line.`;

  // The only tools a customer thread can ever hold act on THEIR order (session
  // id chosen server-side, never by the model) against a listed window.
  const tools: Anthropic.Tool[] = [];
  if (readySessionId) {
    tools.push({
      name: 'book_pickup',
      description: 'Books the customer\'s ready beef into one of the open pickup windows listed in your instructions.',
      input_schema: {
        type: 'object',
        properties: { window_id: { type: 'string', description: 'The window_id of the slot they chose' } },
        required: ['window_id'],
        additionalProperties: false,
      },
    });
  }
  if (scheduledPickup && rescheduleWindows.length) {
    tools.push({
      name: 'request_reschedule',
      description:
        'Asks Grant to move the customer\'s scheduled pickup to one of the other open windows listed in your instructions. Changes NOTHING by itself — Grant must approve first, and the customer gets a confirmation text once he does.',
      input_schema: {
        type: 'object',
        properties: { window_id: { type: 'string', description: 'The window_id of the slot they want instead' } },
        required: ['window_id'],
        additionalProperties: false,
      },
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const convo: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ];

  let reply = '';
  for (let round = 0; round < 3; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: convo,
      ...(tools.length ? { tools } : {}),
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    if (toolUse && readySessionId && toolUse.name === 'book_pickup') {
      const { bookPickup } = await import('@/lib/agent-ops');
      const windowId = String((toolUse.input as { window_id?: string })?.window_id || '');
      const result = /^[0-9a-f-]{36}$/i.test(windowId)
        ? await bookPickup(readySessionId, windowId)
        : { error: 'That window id was not one of the listed options.' };
      convo.push({ role: 'assistant', content: response.content });
      convo.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) }],
      });
      continue;
    }

    if (toolUse && scheduledPickup && toolUse.name === 'request_reschedule') {
      const windowId = String((toolUse.input as { window_id?: string })?.window_id || '');
      const target = rescheduleWindows.find((w) => w.id === windowId);
      let result: Record<string, unknown>;
      if (!target) {
        result = { error: 'That window id was not one of the listed options.' };
      } else {
        // One open request per order — a second ask just stacks confusion.
        const { data: dupe } = await supabase
          .from('agent_pending_actions')
          .select('id')
          .eq('status', 'pending')
          .eq('tool', 'reschedule_pickup')
          .eq('input->args->>session_id', scheduledPickup.sessionId)
          .maybeSingle();
        if (dupe) {
          result = {
            error:
              'A reschedule request for this order is already waiting on Grant — tell them it is pending and they will get a text soon.',
          };
        } else {
          const to = `${target.label}, ${target.pickup_date}, ${String(target.start_time).slice(0, 5)}–${String(target.end_time).slice(0, 5)}`;
          const { data: pendingRow, error: parkErr } = await supabase
            .from('agent_pending_actions')
            .insert({
              tool_use_id: toolUse.id,
              tool: 'reschedule_pickup',
              input: {
                args: {
                  customer: customer?.name || 'Customer',
                  from: scheduledPickup.when,
                  to,
                  session_id: scheduledPickup.sessionId,
                  window_id: windowId,
                  notify_phone: phone,
                },
              },
              channel: 'customer_sms',
            })
            .select('id')
            .single();
          if (parkErr || !pendingRow) {
            result = { error: 'Could not send the request — tell them to call (719) 258-1777.' };
          } else {
            try {
              const { sendAdminSms } = await import('@/lib/sms');
              const { data: older } = await supabase
                .from('agent_pending_actions')
                .select('id')
                .eq('status', 'pending')
                .neq('id', pendingRow.id)
                .limit(1);
              await sendAdminSms(
                `📱 ${customer?.name || 'A customer'} asked to move their pickup.\nFrom: ${scheduledPickup.when}\nTo: ${to}\nReply YES to approve or NO to decline.${
                  older && older.length ? '\n(Another approval is ahead of this one — your reply settles that one first.)' : ''
                }`
              );
            } catch (notifyErr) {
              console.error('Admin reschedule notify failed:', notifyErr);
            }
            result = {
              requested: true,
              note:
                'Request sent to Grant for his OK. Tell the customer it has been sent to the ranch for a quick confirmation and they will get a text shortly. Do NOT say the change is made — their current time stands until then.',
            };
          }
        }
      }
      convo.push({ role: 'assistant', content: response.content });
      convo.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) }],
      });
      continue;
    }

    reply = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text?.trim() || '';
    break;
  }
  if (!reply) {
    reply = `Thanks for reaching out! Grant will follow up with you shortly, or call us at (719) 258-1777.`;
  }

  const now = Date.now();
  await supabase.from('agent_messages').insert([
    {
      channel: 'customer_sms',
      counterparty: phone,
      role: 'user',
      content: [{ type: 'text', text: userText }],
      created_at: new Date(now).toISOString(),
    },
    {
      channel: 'customer_sms',
      counterparty: phone,
      role: 'assistant',
      content: [{ type: 'text', text: reply }],
      created_at: new Date(now + 1000).toISOString(),
    },
  ]);

  return reply;
}
