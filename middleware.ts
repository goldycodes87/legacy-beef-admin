import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Routes reachable without an admin session.
 *
 * /api/auth      — the login endpoint itself.
 * /api/push/notify — called by the customer portal, guarded by its own
 *                    x-notify-secret header check.
 *
 * Everything else, including every /api/admin route, requires a valid session.
 */
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/push/notify'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const authorized = await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (authorized) return NextResponse.next();

  // APIs get a status code; humans get the login page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Static assets stay public — the login page needs its logo and the PWA
  // needs its manifest, icons, and service worker before anyone can sign in.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
