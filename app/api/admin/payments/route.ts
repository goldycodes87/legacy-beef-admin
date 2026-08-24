export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';

/**
 * Every reservation that involves money, with what was actually banked.
 *
 * Previously this filtered to a status list that left out `picked_up`, so
 * completed orders — the ones that generated the revenue — disappeared from
 * the page and every total read $0.00. It also picked whichever deposit row
 * came last, which could be a zero-dollar artifact from the auto-settle job.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, status, balance_due, balance_paid,
      balance_paid_at, balance_payment_method, price_per_lb,
      hanging_weight_lbs, discount_amount, created_at,
      customers(name, email, phone),
      animals(name, butcher_date),
      payments(id, type, status, amount_cents, surcharge_cents, paid_at, method, check_number)
    `)
    .not('status', 'in', '(cancelled,draft)');

  if (!sessions) return NextResponse.json({ records: [], totals: emptyTotals() });

  const records = sessions.map((session: any) => {
    const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
    const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
    const paid = (session.payments || []).filter(
      (p: any) => p.status === 'paid' && (p.amount_cents || 0) > 0
    );

    // Shared with Reservations, Cut Sheets, and the dashboard.
    const {
      orderTotalCents, bankedCents, surchargeCents, outstandingCents,
      depositCents, depositMethod, depositPaidAt, unrecordedSettlement,
    } = summarizeReservation(session);

    return {
      session_id: session.id,
      customer_name: customer?.name || 'Unknown',
      customer_phone: customer?.phone || null,
      animal_name: animal?.name || 'Unknown',
      butcher_date: animal?.butcher_date || null,
      purchase_type: session.purchase_type,
      status: session.status,

      deposit_amount_cents: depositCents,
      deposit_paid_at: depositPaidAt,
      deposit_method: depositMethod,

      // Derived, so a stale column cannot contradict the other tabs.
      balance_due: outstandingCents / 100,
      balance_paid: !!session.balance_paid,
      balance_paid_at: session.balance_paid_at,
      balance_payment_method: session.balance_payment_method,

      order_total_cents: orderTotalCents,
      banked_cents: bankedCents,
      surcharge_cents: surchargeCents,
      outstanding_cents: outstandingCents,
      payment_count: paid.length,
      unrecorded_settlement: unrecordedSettlement,

      hanging_weight_lbs: session.hanging_weight_lbs,
      price_per_lb: session.price_per_lb,
    };
  });

  const totals = records.reduce(
    (acc, r) => {
      acc.deposits_cents += r.deposit_amount_cents ?? 0;
      acc.banked_cents += r.banked_cents;
      acc.surcharge_cents += r.surcharge_cents;
      acc.outstanding_cents += r.outstanding_cents;
      acc.order_total_cents += r.order_total_cents;
      if (r.outstanding_cents > 0) acc.outstanding_count += 1;
      if (r.unrecorded_settlement) acc.unrecorded_count += 1;
      return acc;
    },
    emptyTotals()
  );

  return NextResponse.json({ records, totals });
}

function emptyTotals() {
  return {
    deposits_cents: 0,
    banked_cents: 0,
    surcharge_cents: 0,
    outstanding_cents: 0,
    order_total_cents: 0,
    outstanding_count: 0,
    unrecorded_count: 0,
  };
}
