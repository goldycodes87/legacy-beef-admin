export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Archives a butcher date. Blocked by default while reservations are still
 * open, since archiving hides the date and the orders on it. Pass force to
 * archive anyway — the page asks for confirmation first and says what is open.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await request.json().catch(() => ({}));
  const force = body.force === true;
  const unarchive = body.archived === false;

  if (unarchive) {
    const { error } = await supabase.from('animals').update({ status: 'available' }).eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Could not restore this date', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, status: 'available' });
  }

  if (!force) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('animal_id', id)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'picked_up');

    if (sessions && sessions.length > 0) {
      return NextResponse.json(
        {
          error: `${sessions.length} reservation(s) on this date are not finished yet.`,
          open_count: sessions.length,
          can_force: true,
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from('animals').update({ status: 'archived' }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not archive this date', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: 'archived' });
}
