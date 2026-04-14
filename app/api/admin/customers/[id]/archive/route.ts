export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const { archived } = await request.json();

  await supabase.from('customers').update({
    archived_at: archived ? new Date().toISOString() : null
  }).eq('id', id);

  return NextResponse.json({ success: true });
}
