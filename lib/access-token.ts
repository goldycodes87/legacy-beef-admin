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

/**
 * A link that will still open for at least `minDays` from now.
 *
 * Tokens were minted to expire 60 days after the butcher date, and later emails
 * reused them as-is — so a "beef is ready" link sent after that point landed on
 * the expired page. The token itself is kept (links in earlier emails keep
 * working); only its expiry moves forward.
 */
export async function ensureAccessToken(
  sessionId: string,
  current: { access_token?: string | null; access_token_expires_at?: string | null },
  minDays = 60
): Promise<string> {
  const validUntil = new Date(Date.now() + minDays * DAY_MS);
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
