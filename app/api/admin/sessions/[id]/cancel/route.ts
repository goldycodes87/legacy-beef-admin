export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Get session to release capacity
    const { data: session } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const unitCost = session.purchase_type === 'whole' ? 1.0 : session.purchase_type === 'half' ? 0.5 : 0.25;

    // Release capacity on animal — only if session is not a draft (drafts never incremented units_used)
    if (session.status !== 'draft') {
      const { data: animal } = await supabase.from('animals').select('units_used').eq('id', session.animal_id).single();
      await supabase.from('animals')
        .update({ units_used: Math.max(0, (animal?.units_used || 0) - unitCost) })
        .eq('id', session.animal_id);
    }

    // Mark session cancelled
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to cancel reservation' }, { status: 500 });
  }
}
