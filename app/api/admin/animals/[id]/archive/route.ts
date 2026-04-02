export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Check for active reservations first
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('animal_id', id)
    .not('status', 'eq', 'cancelled')
    .not('status', 'eq', 'picked_up');

  if (sessions && sessions.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot archive — ${sessions.length} active reservation(s) exist.`,
      },
      { status: 400 }
    );
  }

  await supabase.from('animals').update({ status: 'archived' }).eq('id', id);

  return NextResponse.json({ success: true });
}
