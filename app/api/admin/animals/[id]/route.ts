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
    // Check no reservations exist
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('animal_id', id)
      .limit(1);
    if (sessions && sessions.length > 0) {
      return NextResponse.json({ error: 'Cannot delete — reservations exist for this animal' }, { status: 409 });
    }
    const { error } = await supabase.from('animals').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete animal' }, { status: 500 });
  }
}
