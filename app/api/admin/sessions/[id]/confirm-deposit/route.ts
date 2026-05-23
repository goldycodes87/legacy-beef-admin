export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const { method } = await request.json();

    // Load session
    const { data: session } = await supabase
      .from('sessions')
      .select('id, purchase_type, animal_id, is_splitting')
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Calculate deposit amount
    const t = session.purchase_type;
    const s = session.is_splitting;
    const depositCents = (t === 'whole' && !s) ? 85000 : (t === 'whole' && s) ? 50000 : (t === 'half' && s) ? 25000 : (t === 'half') ? 50000 : 25000;

    // Insert payment record
    await supabase.from('payments').insert({
      session_id: id,
      type: 'deposit',
      method: method || 'cash',
      amount_cents: depositCents,
      status: 'paid',
      paid_at: new Date().toISOString(),
    });

    // Update session status
    await supabase.from('sessions')
      .update({ status: 'deposit_paid' })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Confirm deposit error:', err);
    return NextResponse.json({ error: 'Failed to confirm deposit' }, { status: 500 });
  }
}
