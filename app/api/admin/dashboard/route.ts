export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';
import { getStage } from '@/lib/reservation-status';
import { settlePastButcherDates } from '@/lib/settle-butcher-dates';

/**
 * The operational snapshot, derived from the same summary the other tabs use.
 *
 * Capacity is worked out from butcher dates and units actually claimed, not
 * from the animals.status flag — a sold-out date that has already passed used
 * to count as "available" simply because nobody had archived it yet.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // Tidy up finished dates first so this page and Butcher Dates agree, no
    // matter which one gets opened. Only ever archives dates already settled.
    let archivedNow = 0;
    let pastDatesNeedingAttention = 0;
    try {
      const settled = await settlePastButcherDates();
      archivedNow = settled.archived.length;
      pastDatesNeedingAttention = settled.needsAttention.length;
    } catch (settleErr) {
      console.error('Dashboard could not settle past dates:', settleErr);
    }

    const { data: animals } = await supabase
      .from('animals')
      .select('id, butcher_date, status, total_animals, units_used')
      .neq('status', 'archived');

    const upcoming = (animals || []).filter(
      (a: any) => a.butcher_date && a.butcher_date >= today
    );
    const openCapacity = upcoming.reduce(
      (sum: number, a: any) => sum + Math.max(0, (a.total_animals || 0) - (a.units_used || 0)),
      0
    );
    const upcomingDates = new Set(upcoming.map((a: any) => a.butcher_date)).size;

    const { data: sessions } = await supabase
      .from('sessions')
      .select(`
        id, status, cut_sheet_complete, hanging_weight_lbs, price_per_lb,
        discount_amount, balance_paid,
        animals (price_per_lb),
        payments (amount_cents, surcharge_cents, type, status)
      `)
      .not('status', 'in', '(cancelled,draft)');

    let revenueCents = 0;
    let outstandingCents = 0;
    let unrecordedSettlements = 0;
    const stages: Record<string, number> = {
      awaiting_deposit: 0,
      needs_cut_sheet: 0,
      needs_weight: 0,
      balance_due: 0,
      ready_for_pickup: 0,
      picked_up: 0,
    };

    for (const session of sessions || []) {
      const money = summarizeReservation(session as any);
      revenueCents += money.bankedCents;
      outstandingCents += money.outstandingCents;
      if (money.unrecordedSettlement) unrecordedSettlements += 1;

      const stage = getStage({
        status: (session as any).status,
        cut_sheet_complete: (session as any).cut_sheet_complete,
        order_total_cents: money.orderTotalCents,
        banked_cents: money.bankedCents,
        outstanding_cents: money.outstandingCents,
      });
      if (stage in stages) stages[stage] += 1;
    }

    const activeReservations = (sessions || []).length - stages.picked_up;

    return NextResponse.json({
      upcoming_dates: upcomingDates,
      open_capacity: openCapacity,
      active_reservations: activeReservations,
      revenue_collected_cents: revenueCents,
      outstanding_cents: outstandingCents,

      awaiting_deposit: stages.awaiting_deposit,
      pending_cut_sheets: stages.needs_cut_sheet,
      awaiting_hanging_weight: stages.needs_weight,
      balance_due: stages.balance_due,
      ready_for_pickup: stages.ready_for_pickup,
      picked_up: stages.picked_up,

      unrecorded_settlements: unrecordedSettlements,
      past_dates_needing_attention: pastDatesNeedingAttention,
      archived_just_now: archivedNow,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
