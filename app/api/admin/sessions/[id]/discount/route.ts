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
    const { discount_amount, discount_note } = await request.json();

    // Load current session to recalculate balance_due
    const { data: session } = await supabase
      .from('sessions')
      .select('balance_due, discount_amount')
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Recalculate balance_due with new discount
    // Remove old discount, apply new one
    const previousDiscount = session.discount_amount || 0;
    const balanceBeforeDiscount = (session.balance_due || 0) + previousDiscount;
    const newBalanceDue = Math.max(0, balanceBeforeDiscount - discount_amount);

    await supabase.from('sessions').update({
      discount_amount,
      discount_note,
      balance_due: newBalanceDue,
    }).eq('id', id);

    return NextResponse.json({ success: true, balance_due: newBalanceDue });
  } catch (err) {
    console.error('Discount error:', err);
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 });
  }
}
