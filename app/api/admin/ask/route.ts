export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOLS, WRITE_TOOLS, executeTool, logAgentAction } from '@/lib/agent-tools';

/**
 * The admin agent. Auth comes from the middleware that guards every
 * /api/admin route, same as the rest of the panel.
 *
 * A manual tool loop rather than the SDK's runner, deliberately: writes must
 * pause for Grant's approval, and that approval arrives on a *later* HTTP
 * request — the loop has to stop, hand the pending tool_use to the client,
 * and resume when the approval (or refusal) comes back as a tool_result.
 *
 * The client holds the conversation (full content blocks, thinking included,
 * replayed unchanged on the same model). Reads run inline; when the model
 * calls a write tool the route returns {pending_action} and the UI renders
 * Approve / Cancel. Approval executes server-side against WRITE_TOOLS — the
 * client can only approve what the model actually asked for, never name a
 * tool itself.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

const SYSTEM = `You are the operations assistant for Legacy Land & Cattle, a family ranch in Black Forest, Colorado that sells whole, half, and quarter beef shares. You work inside the admin panel; the only user is Grant, the owner.

How the business works: customers reserve a share of an animal on a butcher date and pay a deposit (card immediately, or cash/check which Grant marks received — until then their cut sheet is held). They fill out a cut sheet (quarter buyers get the house sheet). The animal is butchered at T-K Processing, the beef is priced on hanging weight, the customer pays the balance and picks up at the ranch. One animal = 1 unit; a half is 0.5, a quarter 0.25.

Rules:
- Answer from tool data, never from memory. Quote real names, dollars, and dates.
- Be concise and concrete — Grant reads on his phone. Lead with the answer.
- Money: "banked" is net of card surcharges; a $0 banked reservation is unpaid whatever its status says.
- Writes (creating a butcher date, adjusting capacity) always go to Grant for approval — propose them with exact parameters and a one-line consequence, then call the tool.
- If asked to do something you have no tool for, say so plainly and suggest the manual path in the admin.
- The email log is only as complete as the Resend webhook; if it is empty, say the webhook may not be configured rather than concluding no email was sent.`;

interface AskBody {
  messages: Anthropic.MessageParam[];
  /** Present when the user answered a pending write approval. */
  approval?: {
    tool_use_id: string;
    approved: boolean;
    /** Read results from the same model turn, round-tripped from pending. */
    sibling_results?: Anthropic.ToolResultBlockParam[];
  };
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in this project’s environment.' },
      { status: 503 }
    );
  }

  let body: AskBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...(body.messages || [])];

  // Resuming after an approval decision: the pending tool_use is in the last
  // assistant turn. Execute it (or decline) and append the tool_result.
  if (body.approval) {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const blocks = Array.isArray(lastAssistant?.content) ? lastAssistant.content : [];
    const pending = blocks.find(
      (b): b is Anthropic.ToolUseBlock =>
        typeof b === 'object' &&
        b !== null &&
        (b as { type?: string }).type === 'tool_use' &&
        (b as Anthropic.ToolUseBlock).id === body.approval?.tool_use_id
    );
    if (!pending || !WRITE_TOOLS.has(pending.name)) {
      return NextResponse.json({ error: 'No matching pending action.' }, { status: 400 });
    }

    let result: Record<string, unknown>;
    if (body.approval.approved) {
      result = await executeTool(pending.name, pending.input);
      await logAgentAction(pending.name, pending.input, result);
    } else {
      result = { declined: true, note: 'Grant declined this action. Do not retry it unasked.' };
    }
    // Sibling reads from the same model turn were executed before the pause
    // and round-tripped through the client; all results land in one user turn,
    // as the API requires for parallel tool calls.
    const siblings = (body.approval.sibling_results || []).filter(
      (r) => r && r.type === 'tool_result' && typeof r.tool_use_id === 'string'
    );
    messages.push({
      role: 'user',
      content: [
        ...siblings,
        { type: 'tool_result', tool_use_id: pending.id, content: JSON.stringify(result) },
      ],
    });
  }

  try {
    // Tool loop: run reads inline, stop and hand back the first write.
    for (let turn = 0; turn < 12; turn++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: AGENT_TOOLS,
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return NextResponse.json({
          messages,
          reply: 'I can’t help with that request.',
        });
      }

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'pause_turn') continue;

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return NextResponse.json({ messages, reply });
      }

      // A write pauses the loop for approval. Parallel calls mixing reads and
      // a write are resolved by declining the write's siblings' execution
      // order problem simply: writes are returned one at a time.
      const write = toolUses.find((t) => WRITE_TOOLS.has(t.name));
      if (write) {
        // Answer any read calls in the same turn first, so the transcript
        // stays valid; the write's result arrives with the approval.
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const t of toolUses) {
          if (t.id === write.id) continue;
          const r = await executeTool(t.name, t.input);
          results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(r) });
        }
        if (results.length > 0) {
          // The write's tool_result must come with the approval round-trip;
          // stash sibling results now (same user turn will carry both).
          return NextResponse.json({
            messages,
            pending_action: { tool_use_id: write.id, tool: write.name, input: write.input },
            sibling_results: results,
          });
        }
        return NextResponse.json({
          messages,
          pending_action: { tool_use_id: write.id, tool: write.name, input: write.input },
        });
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const t of toolUses) {
        const r = await executeTool(t.name, t.input);
        results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(r) });
      }
      messages.push({ role: 'user', content: results });
    }

    return NextResponse.json({
      messages,
      reply: 'I hit my step limit on that one — ask me to continue.',
    });
  } catch (err) {
    console.error('Ask route error:', err);
    const detail =
      err instanceof Anthropic.APIError ? `${err.status}: ${err.message}` : 'Request failed';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
