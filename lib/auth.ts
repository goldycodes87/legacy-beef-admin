import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'admin_auth';
export const AUTH_TOKEN = 'authenticated';

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE);
  return token?.value === AUTH_TOKEN;
}
