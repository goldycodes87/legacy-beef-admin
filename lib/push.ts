import webpush from 'web-push';
import { getSupabaseAdmin } from './supabase-admin';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:orders@legacylandandcattleco.com',
    publicKey,
    privateKey
  );
} else {
  console.warn('VAPID keys are not configured — push notifications disabled.');
}

export async function sendPushNotification(title: string, body: string, url?: string) {
  if (!publicKey || !privateKey) return;

  const supabase = getSupabaseAdmin();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url || '/slots' });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
}
