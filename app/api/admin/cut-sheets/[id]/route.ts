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
      .select('purchase_type, deposit_amount, animals(price_per_lb)')
      .eq('id', id)
      .single();

    if (session) {
      const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
      const pricePerLb = animal?.price_per_lb || 8.0;
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
    const { section, action } = body.custom_request_action;
    await supabase
      .from('cut_sheet_answers')
      .update({ custom_request_status: action })
      .eq('session_id', id)
      .eq('section', section);
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
