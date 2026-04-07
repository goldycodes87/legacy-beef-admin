export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;

  await supabase.from('sessions')
    .update({ status: 'picked_up' })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
