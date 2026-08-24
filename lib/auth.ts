/**
 * Admin session auth.
 *
 * The cookie holds a signed, expiring token rather than a fixed word, so it
 * cannot be forged by typing a value into devtools. Uses Web Crypto only, so
 * the same helpers run in Edge middleware and in route handlers.
 */

export const AUTH_COOKIE = 'admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Signing secret. Prefers a dedicated secret; falls back to the admin password
 * so an existing deployment keeps working before ADMIN_SESSION_SECRET is added.
 * Set ADMIN_SESSION_SECRET in production — rotating it signs everyone out.
 */
function getSecret(): string | null {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.LEGACY_BEEF_ADMIN_PASSWORD ||
    null
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  return toBase64Url(signature);
}

/** Constant-time compare so a wrong signature can't be found byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns a signed token, or null if no secret is configured. */
export async function createSessionToken(): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${await sign(expiresAt, secret)}`;
}

/** True only for a correctly signed, unexpired token. Fails closed. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!payload || !signature) return false;

  if (!safeEqual(signature, await sign(payload, secret))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/** For server components and route handlers. */
export async function isAuthenticated(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
}
