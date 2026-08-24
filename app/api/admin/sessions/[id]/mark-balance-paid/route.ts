export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

const ALLOWED_METHODS = ['cash', 'check', 'card'] as const;

/**
 * Records a balance paid in person. Previously this only flipped a flag and
 * always stored "cash" regardless of how the customer actually paid, so the
 * payments table — and therefore the financials page — never saw the money.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const method = String(body.method || '').toLowerCase();
    if (!ALLOWED_METHODS.includes(method as (typeof ALLOWED_METHODS)[number])) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${ALLOWED_METHODS.join(', ')}.` },
        { status: 400 }
      );
    }
    const checkNumber = method === 'check' ? (body.check_number || null) : null;

    const { data: session } = await supabase
      .from('sessions')
      .select(`
        id, balance_paid, balance_due, hanging_weight_lbs, price_per_lb, discount_amount,
        animals (price_per_lb),
        payments (amount_cents, surcharge_cents, type, status)
      `)
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if ((session as any).balance_paid) {
      return NextResponse.json(
        { error: 'This balance is already marked paid.' },
        { status: 409 }
      );
    }

    const animal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;

    // Trust the stored balance when it exists, else recompute it.
    const stored = Number((session as any).balance_due);
    const amountDue = Number.isFinite(stored) && stored > 0
      ? stored
      : computeBalance({
          hangingWeightLbs: (session as any).hanging_weight_lbs,
          pricePerLb: (session as any).price_per_lb ?? animal?.price_per_lb,
          payments: (session as any).payments,
          discountAmount: (session as any).discount_amount,
        }).balanceDue;

    const { error: paymentError } = await supabase.from('payments').insert({
      session_id: id,
      type: 'balance',
      method,
      amount_cents: Math.round(amountDue * 100),
      surcharge_cents: 0,
      status: 'paid',
      paid_at: new Date().toISOString(),
      check_number: checkNumber,
    });

    if (paymentError) {
      return NextResponse.json(
        { error: 'Could not record the payment', detail: paymentError.message },
        { status: 500 }
      );
    }

    const { error: sessionError } = await supabase.from('sessions').update({
      balance_paid: true,
      balance_paid_at: new Date().toISOString(),
      balance_payment_method: method,
      balance_due: 0,
    }).eq('id', id);

    if (sessionError) {
      return NextResponse.json(
        { error: 'Payment recorded but the reservation did not update', detail: sessionError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, amount_paid: amountDue, method });
  } catch (err) {
    console.error('Mark balance paid error:', err);
    return NextResponse.json(
      { error: 'Failed to mark balance paid', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
