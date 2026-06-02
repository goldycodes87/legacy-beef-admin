export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { section, answers, half } = await request.json();
  const supabase = getSupabaseAdmin();
  const halfValue = half === 'A' || half === 'B' ? half : null;

  await supabase
    .from('cut_sheet_answers')
    .upsert({
      session_id: id,
      section,
      half: halfValue,
      answers,
      completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cut_sheet_answers_session_section_half_idx' });

  return NextResponse.json({ success: true });
}
