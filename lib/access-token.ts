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
