export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await request.json();

  // Handle hanging weight entry + balance calculation
  if (body.hanging_weight_lbs !== undefined) {
    const weight = Number(body.hanging_weight_lbs);
    if (!Number.isFinite(weight) || weight < 50 || weight > 1200) {
      return NextResponse.json(
        { error: 'Hanging weight must be between 50 and 1200 lbs.' },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from('sessions')
      .select(`
        purchase_type, price_per_lb, discount_amount, balance_paid,
        animals(price_per_lb),
        payments(amount_cents, surcharge_cents, type, status)
      `)
      .eq('id', id)
      .single();

    if (session) {
      const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
      // Same calculator the rest of the app uses: the price quoted at booking,
      // deposits net of card surcharge, and any discount.
      const { balanceDue } = computeBalance({
        hangingWeightLbs: weight,
        pricePerLb: session.price_per_lb ?? animal?.price_per_lb,
        payments: (session as any).payments,
        discountAmount: (session as any).discount_amount,
      });

      const update: Record<string, unknown> = { hanging_weight_lbs: weight };
      if (!(session as any).balance_paid) update.balance_due = balanceDue;

      await supabase.from('sessions').update(update).eq('id', id);

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
