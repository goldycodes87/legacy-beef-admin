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
    const { new_animal_id } = await request.json();

    // Get current session
    const { data: session } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const unitCost = session.purchase_type === 'whole' ? 1.0 : session.purchase_type === 'half' ? 0.5 : 0.25;

    // Release capacity from old animal
    const { data: oldAnimal } = await supabase.from('animals').select('units_used').eq('id', session.animal_id).single();
    await supabase.from('animals')
      .update({ units_used: Math.max(0, (oldAnimal?.units_used || 0) - unitCost) })
      .eq('id', session.animal_id);

    // Add capacity to new animal
    const { data: newAnimal } = await supabase.from('animals').select('units_used').eq('id', new_animal_id).single();
    await supabase.from('animals')
      .update({ units_used: (newAnimal?.units_used || 0) + unitCost })
      .eq('id', new_animal_id);

    // Update session
    await supabase.from('sessions').update({ animal_id: new_animal_id }).eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to move reservation' }, { status: 500 });
  }
}
