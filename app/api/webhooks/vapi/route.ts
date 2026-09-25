export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { runAgentTurn } from '@/lib/agent-core';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * The voice line. A Vapi assistant handles the phone call itself (speech,
 * turn-taking, small talk) and calls one custom tool — ask_rusty — whenever
 * Grant asks for facts or actions. That tool posts here, we run the same
 * brain the web and SMS channels use, and Vapi speaks the answer.
 *
 * Writes stay approval-gated: on a call the agent proposes the action, it
 * lands in the pending queue, and the spoken reply tells Grant to approve by
 * text (YES) or in the admin. A phone call is the wrong place for a
 * destructive tap — deliberately.
 *
 * Auth: Vapi sends the shared secret configured on the server URL in the
 * x-vapi-secret header (VAPI_SERVER_SECRET here). The Clozr-style
 * end-of-call-report is also accepted and archived into agent_messages so
 * memory covers what was said on calls.
 */

export async function POST(request: NextRequest) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  if (request.headers.get('x-vapi-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  if (!message) return NextResponse.json({ received: true });

  // Only Grant's caller ID may use the tool. A stranger who finds the Vapi
  // number gets small talk from the assistant but no business data and no
  // actions - every tool call from an unrecognized caller is refused here.
  const callerNumber = String(message.call?.customer?.number || body?.call?.customer?.number || '')
    .replace(/[^\d]/g, '')
    .replace(/^1/, '');
  const grantCell = (process.env.ADMIN_SMS_TO || '').replace(/[^\d]/g, '').replace(/^1/, '');
  const callerIsGrant = !callerNumber || (grantCell !== '' && callerNumber === grantCell);

  // Tool call from the assistant mid-call.
  if (message.type === 'tool-calls') {
    if (!callerIsGrant) {
      const refused: Array<{ id: string }> = message.toolCallList || message.toolCalls || [];
      return NextResponse.json({
        results: refused.map((c) => ({
          toolCallId: c.id,
          result:
            'This line is for the owner only. Please call the ranch directly at (719) 258-1777.',
        })),
      });
    }
    const calls: Array<{ id: string; function?: { name?: string; arguments?: unknown } }> =
      message.toolCallList || message.toolCalls || [];

    const results = [];
    for (const call of calls) {
      let question = '';
      const rawArgs = call.function?.arguments;
      try {
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        question = (args as { question?: string })?.question || '';
      } catch {
        /* fall through */
      }

      let resultText = 'I did not catch a question.';
      if (question) {
        try {
          const r = await runAgentTurn('voice', question);
          resultText = r.reply || 'Done.';
          if (r.pending) {
            resultText += ` I have queued that up — it needs your approval. Reply YES to my text, or open the admin.`;
          }
        } catch (err) {
          console.error('Voice agent turn failed:', err);
          resultText = 'I hit a snag looking that up. Try me again in a minute.';
        }
      }
      results.push({ toolCallId: call.id, result: resultText });
    }
    return NextResponse.json({ results });
  }

  // End of call: archive the spoken transcript into the shared history.
  if (message.type === 'end-of-call-report') {
    const transcript: string = message.transcript || body?.transcript || '';
    if (transcript) {
      const turns = transcript
        .split('\n')
        .map((line: string) => {
          if (/^(user|grant):/i.test(line)) {
            return { role: 'user', text: line.replace(/^[^:]+:\s*/, '').trim() };
          }
          if (/^(assistant|ai|bot):/i.test(line)) {
            return { role: 'assistant', text: line.replace(/^[^:]+:\s*/, '').trim() };
          }
          return null;
        })
        .filter((t: { role: string; text: string } | null): t is { role: string; text: string } =>
          Boolean(t && t.text)
        );

      if (turns.length > 0) {
        const supabase = getSupabaseAdmin();
        const now = Date.now();
        await supabase.from('agent_messages').insert(
          turns.map((t: { role: string; text: string }, i: number) => ({
            channel: 'voice',
            role: t.role,
            content: [{ type: 'text', text: t.text }],
            created_at: new Date(now + i * 1000).toISOString(),
          }))
        );
      }
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
