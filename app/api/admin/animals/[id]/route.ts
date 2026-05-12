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
      // Cascade delete in order
      await supabase.from('pickup_appointments').delete().in('session_id', sessionIds);
      await supabase.from('notifications').delete().in('session_id', sessionIds);
      await supabase.from('payments').delete().in('session_id', sessionIds);
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
