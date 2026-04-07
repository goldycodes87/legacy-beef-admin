export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const HOUSE_DEFAULTS: Record<string, object> = {
  chuck: { choice: 'steaks', thickness: '1"', steaks_per_pack: 2 },
  brisket: { choice: 'half' },
  skirt: { choice: true },
  rib: { choice: 'bone_in_steaks', thickness: '1"', steaks_per_pack: 2 },
  short_ribs: { choice: true },
  sirloin: { choice: 'steaks', thickness: '1"', steaks_per_pack: 2 },
  round: { choice: 'grind' },
  short_loin: { choice: 'tbone', tbone_thickness: '1"', steaks_per_pack: 2 },
  flank: { choice: true },
  stew_meat: { choice: false },
  tenderized_round: { choice: 'skipped' },
  organs: { choices: ['none'] },
  bones: { choices: ['soup'] },
  packing: { fat_pct: '85/15', lbs_per_pack: 1 },
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;

  const sections = Object.keys(HOUSE_DEFAULTS);
  const { data: existing } = await supabase
    .from('cut_sheet_answers')
    .select('section')
    .eq('session_id', id);

  const existingSections = new Set(existing?.map((r: any) => r.section) || []);

  const toInsert = sections
    .filter(s => !existingSections.has(s))
    .map(s => ({
      session_id: id,
      section: s,
      answers: { ...HOUSE_DEFAULTS[s], house_default: true },
      completed: true,
      locked: true,
    }));

  if (toInsert.length > 0) {
    await supabase.from('cut_sheet_answers').insert(toInsert);
  }

  await supabase.from('cut_sheet_answers')
    .update({ locked: true })
    .eq('session_id', id);

  await supabase.from('sessions')
    .update({
      status: 'locked',
      cut_sheet_complete: true,
      cut_sheet_locked_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
