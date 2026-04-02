export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { section, answers } = await request.json();
  const supabase = getSupabaseAdmin();

  await supabase
    .from('cut_sheet_answers')
    .upsert({
      session_id: id,
      section,
      answers,
      completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,section' });

  return NextResponse.json({ success: true });
}
