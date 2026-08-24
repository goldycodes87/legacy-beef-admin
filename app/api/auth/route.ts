export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from '@/lib/auth';

/** Constant-time compare so the password can't be guessed character by character. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.LEGACY_BEEF_ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('LEGACY_BEEF_ADMIN_PASSWORD is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (typeof password !== 'string' || !safeEqual(password, adminPassword)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await createSessionToken();
    if (!token) {
      console.error('No signing secret available for admin sessions');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE);
  // Clear the retired cookie too, so old sessions don't linger in browsers.
  response.cookies.delete('admin_auth');
  return response;
}
