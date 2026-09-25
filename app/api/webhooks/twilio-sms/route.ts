export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { runAgentTurn, decideAction, getPendingAction, refreshAgentMemory } from '@/lib/agent-core';
import { sendAdminSms } from '@/lib/sms';

/**
 * Grant texts the employee. Twilio posts inbound SMS here; only messages from
 * Grant's own cell (ADMIN_SMS_TO) are ever processed, everything else is
 * acknowledged and dropped so a stranger texting the ranch number can't reach
 * the agent or its tools.
 *
 * Twilio's webhook timeout is ~15s and agent turns can run longer, so the
 * route answers immediately with empty TwiML and does the thinking in
 * after(), replying via the normal outbound SMS path.
 *
 * Approvals over SMS: when a write is pending, YES approves and NO declines.
 * Anything else while a write is pending is answered with a reminder.
 *
 * Setup: Twilio Console → the ranch number → Messaging → "A message comes
 * in" → Webhook, POST, https://admin.legacylandandcattleco.com/api/webhooks/twilio-sms
 * (middleware exempts /api/webhooks/*; signature verification stands in for
 * the admin session).
 */

const EMPTY_TWIML = new NextResponse(
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  { headers: { 'Content-Type': 'text/xml' } }
);

function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function normalizePhone(n: string | null | undefined): string {
  return (n || '').replace(/[^\d]/g, '').replace(/^1/, '');
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const grantCell = process.env.ADMIN_SMS_TO;
  if (!authToken || !grantCell || !process.env.ANTHROPIC_API_KEY) {
    return new NextResponse('not configured', { status: 503 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === 'string') params[k] = v;
  });

  // Twilio signs the exact public URL it posted to.
  const url = `https://${request.headers.get('host')}/api/webhooks/twilio-sms`;
  const signature = request.headers.get('x-twilio-signature') || '';
  if (!verifyTwilioSignature(authToken, url, params, signature)) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  // Only Grant. A customer texting the ranch number gets silence from the
  // agent (their message still shows in Twilio logs for the future inbox).
  if (normalizePhone(params.From) !== normalizePhone(grantCell)) {
    return EMPTY_TWIML;
  }

  const text = (params.Body || '').trim();
  if (!text) return EMPTY_TWIML;

  after(async () => {
    try {
      const pending = await getPendingAction();
      let reply: string;
      let newPending: { tool: string; input: Record<string, unknown> } | null = null;

      if (pending) {
        const answer = text.toUpperCase();
        if (answer === 'YES' || answer === 'Y' || answer === 'APPROVE') {
          const r = await decideAction(pending.id, true, 'sms');
          reply = r.reply;
          newPending = r.pending;
        } else if (answer === 'NO' || answer === 'N' || answer === 'CANCEL') {
          const r = await decideAction(pending.id, false, 'sms');
          reply = r.reply;
          newPending = r.pending;
        } else {
          reply = `Still waiting on your call for: ${pending.tool.replace(/_/g, ' ')} ${JSON.stringify(
            pending.args
          )}. Reply YES to approve or NO to cancel.`;
        }
      } else {
        const r = await runAgentTurn('sms', text);
        reply = r.reply;
        newPending = r.pending;
      }

      if (newPending) {
        reply =
          `${reply ? reply + '\n\n' : ''}Needs your OK: ${newPending.tool.replace(/_/g, ' ')} ` +
          `${JSON.stringify(newPending.input)}. Reply YES to approve or NO to cancel.`;
      }

      await sendAdminSms(reply || 'Done.');
      void refreshAgentMemory();
    } catch (err) {
      console.error('SMS agent turn failed:', err);
      await sendAdminSms('Something broke while I was working on that — check the admin.');
    }
  });

  return EMPTY_TWIML;
}
