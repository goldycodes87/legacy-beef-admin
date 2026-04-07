export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const { admin_notes } = await request.json();

  await supabase.from('sessions')
    .update({ admin_notes })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
