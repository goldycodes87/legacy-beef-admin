/**
 * Text alerts to Grant via Twilio.
 *
 * Dormant until three env vars exist in Vercel — no SDK, just Twilio's REST
 * API, so there is nothing to install:
 *
 *   TWILIO_ACCOUNT_SID   from the Twilio console dashboard
 *   TWILIO_AUTH_TOKEN    same page
 *   TWILIO_FROM_NUMBER   the ranch number, E.164 format: +17192581777
 *   ADMIN_SMS_TO         Grant's cell, E.164 format: +1XXXXXXXXXX
 *
 * The same number that takes calls can send SMS if its Twilio "Capabilities"
 * row shows SMS. For business texting Twilio also requires A2P 10DLC brand +
 * campaign registration (Console → Messaging → Regulatory Compliance) or
 * carriers will filter the messages.
 *
 * This file is mirrored from legacy-beef-portal/src/lib/sms.ts.
 */

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.ADMIN_SMS_TO
  );
}

/** Fire-and-forget text to Grant. Never throws — an alert must not break a sale. */
export async function sendAdminSms(body: string): Promise<void> {
  if (!smsConfigured()) return;

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: process.env.TWILIO_FROM_NUMBER!,
        To: process.env.ADMIN_SMS_TO!,
        Body: body.slice(0, 1600),
      }),
    });
    if (!res.ok) {
      console.error('Twilio SMS failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Twilio SMS error:', err);
  }
}
