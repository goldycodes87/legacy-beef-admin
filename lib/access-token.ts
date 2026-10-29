import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createAccessToken(sessionId: string, expiresAt: Date): Promise<string> {
  const supabase = getSupabaseAdmin();
  const token = generateAccessToken();
  await supabase.from('sessions').update({
    access_token: token,
    access_token_expires_at: expiresAt.toISOString(),
  }).eq('id', sessionId);
  return token;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 60 days after butcher day — long enough to cover aging, cutting and pickup. */
export function linkLifetime(butcherDate: string | null | undefined): Date {
  const base = butcherDate ? new Date(`${butcherDate}T00:00:00`) : new Date();
  return new Date(base.getTime() + 60 * DAY_MS);
}

/**
 * A link that will still open for at least `minDays` from now (and at least
 * until `until`, when given).
 *
 * Tokens were minted to expire 60 days after the butcher date, and later emails
 * reused them as-is — so a "beef is ready" link sent after that point landed on
 * the expired page. The token itself is kept (links in earlier emails keep
 * working); only its expiry moves forward.
 */
export async function ensureAccessToken(
  sessionId: string,
  current: { access_token?: string | null; access_token_expires_at?: string | null },
  minDays = 60,
  until?: Date
): Promise<string> {
  const floor = Date.now() + minDays * DAY_MS;
  const validUntil = new Date(Math.max(floor, until?.getTime() ?? 0));
  if (!current.access_token) return createAccessToken(sessionId, validUntil);

  const expires = current.access_token_expires_at ? new Date(current.access_token_expires_at) : null;
  if (!expires || expires < validUntil) {
    await getSupabaseAdmin()
      .from('sessions')
      .update({ access_token_expires_at: validUntil.toISOString() })
      .eq('id', sessionId);
  }
  return current.access_token;
}
