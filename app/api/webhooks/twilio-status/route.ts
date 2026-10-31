export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Twilio delivery-status callbacks. Every outbound text (admin alerts and
 * Rusty's customer texts, from either app) names this URL as its
 * StatusCallback, and Twilio posts here on each status change:
 * queued → sent → delivered / undelivered / failed.
 *
 * One row per message in sms_delivery, keyed by MessageSid, kept at the
 * furthest-along status — callbacks can arrive out of order, so a "sent"
 * that shows up after "delivered" must not regress the row. This is the
 * silent log Rusty reads (check_sms_delivery); nothing is sent from here.
 *
 * Signature-verified like the inbound SMS webhook; refuses to run
 * unconfigured. Middleware exempts /api/webhooks/*.
 */

// Twilio's lifecycle, in order. Unknown statuses rank highest so a new
// terminal status Twilio adds later is never dropped.
const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  queued: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  undelivered: 3,
  failed: 3,
  read: 4,
};

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

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return new NextResponse('not configured', { status: 503 });

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === 'string') params[k] = v;
  });

  // Twilio signs the exact public URL it posted to.
  const url = `https://${request.headers.get('host')}/api/webhooks/twilio-status`;
  const signature = request.headers.get('x-twilio-signature') || '';
  if (!verifyTwilioSignature(authToken, url, params, signature)) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  const sid = params.MessageSid || params.SmsSid;
  const status = (params.MessageStatus || params.SmsStatus || '').toLowerCase();
  if (!sid || !status) return new NextResponse('ok');

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('sms_delivery')
    .select('status')
    .eq('message_sid', sid)
    .maybeSingle();

  const rank = STATUS_RANK[status] ?? 5;
  if (existing && (STATUS_RANK[existing.status] ?? 5) > rank) {
    return new NextResponse('ok'); // stale callback — keep the newer status
  }

  await supabase.from('sms_delivery').upsert(
    {
      message_sid: sid,
      to_phone: params.To || null,
      from_phone: params.From || null,
      status,
      error_code: params.ErrorCode || null,
      delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'message_sid' }
  );

  return new NextResponse('ok');
}
