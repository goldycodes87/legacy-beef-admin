export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, status, cut_sheet_complete, cut_sheet_locked_at,
      dual_cut_sheet, half_a_complete, half_b_complete, half_a_locked_at, half_b_locked_at,
      hanging_weight_lbs, price_per_lb, discount_amount,
      balance_due, balance_paid, deposit_amount, last_viewed_at,
      customers(id, name, email, phone),
      animals(id, name, butcher_date, estimated_ready_date, animal_type, price_per_lb),
      payments(id, type, status, amount_cents, surcharge_cents, paid_at, method),
      cut_sheet_answers(section, answers, completed, locked, custom_request, custom_request_status, half)
    `)
    .not('status', 'eq', 'draft')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Same money summary the other tabs use, so a balance shown here matches
  // Reservations and Payments rather than a stale deposit_amount column.
  const enriched = (data || []).map((session: any) => {
    const money = summarizeReservation(session);
    return {
      ...session,
      deposit_amount: money.depositCents !== null ? money.depositCents / 100 : 0,
      balance_due: money.outstandingCents / 100,
      order_total_cents: money.orderTotalCents,
      banked_cents: money.bankedCents,
      outstanding_cents: money.outstandingCents,
    };
  });

  return NextResponse.json(enriched);
}
