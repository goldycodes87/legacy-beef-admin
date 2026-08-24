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
    const { new_animal_id } = await request.json();

    if (!new_animal_id) {
      return NextResponse.json({ error: 'Pick a butcher date to move this reservation to.' }, { status: 400 });
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, status, purchase_type, animal_id')
      .eq('id', id)
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (session.animal_id === new_animal_id) {
      return NextResponse.json({ error: 'That reservation is already on this butcher date.' }, { status: 400 });
    }

    const unitCost = unitCostFor(session.purchase_type);
    const holdsCapacity = session.status !== 'draft' && session.status !== 'cancelled';

    // Claim on the destination first. If it is full, nothing has changed yet.
    if (holdsCapacity) {
      const { error: claimError } = await supabase.rpc('adjust_animal_units', {
        p_animal_id: new_animal_id,
        p_delta: unitCost,
      });

      if (claimError) {
        if (claimError.message?.includes('insufficient_capacity')) {
          return NextResponse.json(
            { error: 'That butcher date does not have room for this order.' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'Could not reserve space on that date', detail: claimError.message },
          { status: 500 }
        );
      }
    }

    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ animal_id: new_animal_id })
      .eq('id', id);

    if (sessionError) {
      // Put the destination capacity back so it is not stranded.
      if (holdsCapacity) {
        await supabase.rpc('adjust_animal_units', { p_animal_id: new_animal_id, p_delta: -unitCost });
      }
      return NextResponse.json(
        { error: 'Failed to move reservation', detail: sessionError.message },
        { status: 500 }
      );
    }

    // Only release the origin once the move is committed.
    if (holdsCapacity) {
      const { error: releaseError } = await supabase.rpc('adjust_animal_units', {
        p_animal_id: session.animal_id,
        p_delta: -unitCost,
      });

      if (releaseError) {
        console.error(`Moved session ${id} but did not release the old slot`, releaseError);
        return NextResponse.json(
          { error: 'Reservation moved, but the old slot was not released. Check the animal capacity.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Move reservation error:', err);
    return NextResponse.json(
      { error: 'Failed to move reservation', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
