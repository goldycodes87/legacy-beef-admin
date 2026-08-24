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

  // onConflict takes column names, not an index name. Passing the index name
  // made every upsert fail, so edits made here were silently thrown away while
  // the route still reported success.
  const { error } = await supabase
    .from('cut_sheet_answers')
    .upsert({
      session_id: id,
      section,
      half: halfValue,
      answers,
      completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,section,half' });

  if (error) {
    console.error('Failed to save cut sheet section:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
