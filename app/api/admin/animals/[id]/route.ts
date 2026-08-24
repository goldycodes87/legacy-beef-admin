export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();
    const { data, error } = await supabase
      .from('animals')
      .update({
        total_animals: body.total_animals,
        butcher_date: body.butcher_date,
        estimated_ready_date: body.estimated_ready_date,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update animal' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Check for active (non-cancelled, non-picked_up) sessions
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('animal_id', id)
      .not('status', 'in', '(cancelled,picked_up)')
      .limit(1);

    if (activeSessions && activeSessions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete — active reservations exist for this animal' },
        { status: 409 }
      );
    }

    // Get all sessions for this animal (including cancelled)
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('animal_id', id);

    const sessionIds = (allSessions || []).map(s => s.id);

    if (sessionIds.length > 0) {
      // Refuse if money was ever recorded against this animal. Deleting would
      // destroy the payments rows that evidence it. Archive instead.
      const { data: paymentRows } = await supabase
        .from('payments')
        .select('id')
        .in('session_id', sessionIds)
        .limit(1);

      if (paymentRows && paymentRows.length > 0) {
        return NextResponse.json(
          {
            error:
              'This butcher date has payment history, which must be kept. Archive it instead — it will be hidden but the record stays.',
          },
          { status: 409 }
        );
      }

      // Only reachable for dates whose reservations never involved money.
      await supabase.from('pickup_appointments').delete().in('session_id', sessionIds);
      await supabase.from('notifications').delete().in('session_id', sessionIds);
      await supabase.from('cut_sheet_answers').delete().in('session_id', sessionIds);
      await supabase.from('sessions').delete().in('id', sessionIds);
    }

    const { error } = await supabase.from('animals').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json({ error: 'Failed to delete animal' }, { status: 500 });
  }
}
