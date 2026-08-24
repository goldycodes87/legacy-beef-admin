export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { unitCostFor } from '@/lib/inventory';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { data: session } = await supabase
      .from('sessions')
      .select('id, status, purchase_type, animal_id')
      .eq('id', id)
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'This reservation is already cancelled.' }, { status: 409 });
    }

    // Mark cancelled first. If releasing capacity then fails we have a spot
    // held by a cancelled order, which is visible and fixable; the reverse
    // would double-release capacity on a retry.
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (sessionError) {
      return NextResponse.json(
        { error: 'Failed to cancel reservation', detail: sessionError.message },
        { status: 500 }
      );
    }

    // Drafts never claimed capacity, so there is nothing to give back.
    if (session.status !== 'draft') {
      const { error: releaseError } = await supabase.rpc('adjust_animal_units', {
        p_animal_id: session.animal_id,
        p_delta: -unitCostFor(session.purchase_type),
      });

      if (releaseError) {
        console.error(`Cancelled session ${id} but did not release capacity`, releaseError);
        return NextResponse.json(
          { error: 'Reservation cancelled, but the slot was not released. Check the animal capacity.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cancel reservation error:', err);
    return NextResponse.json(
      { error: 'Failed to cancel reservation', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
