export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await request.json();

  // Handle hanging weight entry + balance calculation
  if (body.hanging_weight_lbs !== undefined) {
    const { data: session } = await supabase
      .from('sessions')
      .select('purchase_type, deposit_amount, price_per_lb, animals(price_per_lb)')
      .eq('id', id)
      .single();

    if (session) {
      const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
      // The price quoted at booking is what the customer owes.
      const pricePerLb = session.price_per_lb ?? animal?.price_per_lb ?? 0;
      const totalDue = body.hanging_weight_lbs * pricePerLb;
      const deposit = session.deposit_amount || 0;
      const balanceDue = Math.max(0, totalDue - deposit);

      await supabase
        .from('sessions')
        .update({
          hanging_weight_lbs: body.hanging_weight_lbs,
          balance_due: balanceDue,
        })
        .eq('id', id);

      return NextResponse.json({ success: true, balance_due: balanceDue });
    }
  }

  // Handle custom request approval/denial
  if (body.custom_request_action) {
    const { section, action, half } = body.custom_request_action as { section: string; action: string; half?: string };
    const query = supabase
      .from('cut_sheet_answers')
      .update({ custom_request_status: action })
      .eq('session_id', id)
      .eq('section', section);
    if (half === 'A' || half === 'B') {
      query.eq('half', half);
    } else {
      query.is('half', null);
    }
    await query;
    return NextResponse.json({ success: true });
  }

  // Handle mark beef ready
  if (body.mark_beef_ready) {
    await supabase
      .from('sessions')
      .update({ status: 'beef_ready', beef_ready_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 });
}
