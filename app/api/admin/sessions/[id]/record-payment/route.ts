export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

const ALLOWED_METHODS = ['cash', 'check', 'card'];

/**
 * Records money taken outside the online checkout.
 *
 * Covers the case where a customer never paid a deposit but settled the whole
 * order at pickup: pass paid_in_full and it records what is actually
 * outstanding, so the books and the customer's status both end up right.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const method = String(body.method || '').toLowerCase();
    if (!ALLOWED_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${ALLOWED_METHODS.join(', ')}.` },
        { status: 400 }
      );
    }

    // The Square POS callback records automatically and can fire twice (page
    // reload, back button). The transaction id makes the operation idempotent.
    const squareTransactionId =
      typeof body.square_transaction_id === 'string' && body.square_transaction_id.trim()
        ? body.square_transaction_id.trim()
        : null;
    if (squareTransactionId) {
      const { data: existing } = await supabase
        .from('payments')
        .select('id, amount_cents')
        .eq('session_id', id)
        .eq('square_payment_id', squareTransactionId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          success: true,
          already_recorded: true,
          amount_recorded: (existing.amount_cents || 0) / 100,
        });
      }
    }

    const { data: session } = await supabase
      .from('sessions')
      .select(`
        id, status, purchase_type, hanging_weight_lbs, price_per_lb,
        discount_amount, balance_due, balance_paid,
        animals (price_per_lb),
        payments (amount_cents, surcharge_cents, type, status)
      `)
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const animal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;
    const payments = ((session as any).payments || []) as {
      amount_cents: number | null; surcharge_cents: number | null; type: string; status: string;
    }[];

    // Money already banked against this order, ignoring the zero-dollar rows
    // the old auto-settle job left behind.
    const recordedCents = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Math.max(0, (p.amount_cents || 0) - (p.surcharge_cents || 0)), 0);

    const { totalCost } = computeBalance({
      hangingWeightLbs: (session as any).hanging_weight_lbs,
      pricePerLb: (session as any).price_per_lb ?? animal?.price_per_lb,
      payments: [],
      discountAmount: 0,
    });
    const discount = Number((session as any).discount_amount) || 0;
    const owedCents = Math.max(0, Math.round((totalCost - discount) * 100) - recordedCents);

    const paidInFull = body.paid_in_full === true;
    let amountCents: number;

    if (paidInFull) {
      if (owedCents <= 0) {
        return NextResponse.json(
          { error: 'Nothing is outstanding on this reservation.' },
          { status: 409 }
        );
      }
      amountCents = owedCents;
    } else {
      const dollars = Number(body.amount);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
      }
      amountCents = Math.round(dollars * 100);
    }

    if (totalCost > 0 && amountCents > owedCents) {
      return NextResponse.json(
        {
          error: `That is more than the $${(owedCents / 100).toFixed(2)} still outstanding.`,
        },
        { status: 400 }
      );
    }

    // Recorded as a balance payment: only one real deposit row is allowed per
    // reservation, and a settle-up at pickup is not a deposit.
    const type = body.type === 'deposit' ? 'deposit' : 'balance';

    const { error: insertError } = await supabase.from('payments').insert({
      session_id: id,
      type,
      method,
      amount_cents: amountCents,
      surcharge_cents: 0,
      status: 'paid',
      paid_at: new Date().toISOString(),
      check_number: method === 'check' ? (body.check_number || null) : null,
      square_payment_id: squareTransactionId,
    });

    if (insertError) {
      const duplicate = insertError.message?.includes('payments_one_paid');
      return NextResponse.json(
        {
          error: duplicate
            ? `A ${type} payment is already recorded for this reservation.`
            : 'Could not record the payment',
          detail: insertError.message,
        },
        { status: duplicate ? 409 : 500 }
      );
    }

    // Settle the reservation when nothing is left owing.
    const stillOwedCents = owedCents - amountCents;
    const update: Record<string, unknown> = { balance_due: Math.max(0, stillOwedCents) / 100 };
    if (stillOwedCents <= 0) {
      update.balance_paid = true;
      update.balance_paid_at = new Date().toISOString();
      update.balance_payment_method = method;
    }
    if ((session as any).status === 'draft') update.status = 'deposit_paid';

    const { error: updateError } = await supabase.from('sessions').update(update).eq('id', id);
    if (updateError) {
      return NextResponse.json(
        { error: 'Payment recorded but the reservation did not update', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      amount_recorded: amountCents / 100,
      still_outstanding: Math.max(0, stillOwedCents) / 100,
      settled: stillOwedCents <= 0,
    });
  } catch (err) {
    console.error('Record payment error:', err);
    return NextResponse.json(
      { error: 'Failed to record payment', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
