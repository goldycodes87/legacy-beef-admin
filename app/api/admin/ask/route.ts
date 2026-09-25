export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  runAgentTurn,
  decideAction,
  getPendingAction,
  refreshAgentMemory,
} from '@/lib/agent-core';

/**
 * Web channel for the employee. Auth comes from the middleware guarding
 * /api/admin. The conversation lives server-side now (shared with SMS and
 * voice), so this route is thin: GET returns the transcript + any pending
 * approval; POST sends a message or decides an approval.
 */

export async function GET() {
  const supabase = getSupabaseAdmin();
  const [{ data: rows }, pending, { data: config }] = await Promise.all([
    supabase
      .from('agent_messages')
      .select('role, content, channel, created_at')
      .order('created_at', { ascending: false })
      .limit(60),
    getPendingAction(),
    supabase.from('agent_config').select('name').eq('id', 1).maybeSingle(),
  ]);

  // Render only human-visible text; tool traffic stays server-side.
  const transcript = (rows || [])
    .reverse()
    .map((r) => {
      const blocks = r.content as Array<{ type?: string; text?: string }>;
      const text = Array.isArray(blocks)
        ? blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim()
        : '';
      return text ? { who: r.role, text, channel: r.channel } : null;
    })
    .filter(Boolean);

  return NextResponse.json({
    name: config?.name || 'Rusty',
    transcript,
    pending: pending ? { id: pending.id, tool: pending.tool, input: pending.args } : null,
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in this project’s environment.' },
      { status: 503 }
    );
  }

  let body: { text?: string; approval?: { id: string; approved: boolean } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const result = body.approval
      ? await decideAction(body.approval.id, body.approval.approved, 'web')
      : body.text?.trim()
        ? await runAgentTurn('web', body.text.trim())
        : null;

    if (!result) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

    // Best-effort memory refresh after the response goes out.
    after(() => refreshAgentMemory());

    return NextResponse.json({
      reply: result.reply,
      pending: result.pending
        ? { id: result.pending.id, tool: result.pending.tool, input: result.pending.input }
        : null,
    });
  } catch (err) {
    console.error('Ask route error:', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
