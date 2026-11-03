export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * A banned customer cannot place a new order or join the waitlist on the
 * portal, and Rusty will not sell to them by text. Existing orders are not
 * touched — service on beef they already bought continues as normal.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const { banned } = await request.json();

  await supabase.from('customers').update({
    banned_at: banned ? new Date().toISOString() : null
  }).eq('id', id);

  return NextResponse.json({ success: true });
}
