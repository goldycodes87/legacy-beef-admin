import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { summarizeReservation } from '@/lib/reservation';

export interface OpenItem {
  customer_name: string;
  reason: string;
}

export interface SettleResult {
  archived: { id: string; name: string }[];
  needsAttention: { id: string; name: string; butcher_date: string; open: OpenItem[] }[];
  /** Dates that were finished but could not be archived, with the reason. */
  failed: { id: string; name: string; reason: string }[];
}

/**
 * Closes out butcher dates that are behind us.
 *
 * A date is finished when every reservation on it has been picked up and has
 * nothing outstanding. Those archive themselves. Anything past its date with
 * loose ends is reported instead, so an unpaid order is never quietly hidden.
 *
 * Safe to call repeatedly — it only ever archives dates that are already done.
 */
export async function settlePastButcherDates(): Promise<SettleResult> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: animals, error } = await supabase
    .from('animals')
    .select(`
      id, name, butcher_date, status,
      sessions (
        id, status, balance_paid, balance_due, hanging_weight_lbs,
        price_per_lb, discount_amount,
        customers (name),
        payments (amount_cents, surcharge_cents, type, status)
      )
    `)
    .neq('status', 'archived')
    .lt('butcher_date', today);

  if (error) throw error;

  const archived: SettleResult['archived'] = [];
  const needsAttention: SettleResult['needsAttention'] = [];
  const failed: SettleResult['failed'] = [];

  for (const animal of animals || []) {
    const sessions = ((animal as any).sessions || []).filter(
      (s: any) => s.status !== 'cancelled' && s.status !== 'draft'
    );

    const open: OpenItem[] = [];

    for (const s of sessions) {
      const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
      const name = customer?.name || 'Unknown customer';
      const money = summarizeReservation(s);

      if (money.orderTotalCents === 0) {
        open.push({ customer_name: name, reason: 'no hanging weight entered' });
      } else if (money.outstandingCents > 0) {
        open.push({
          customer_name: name,
          reason: `owes $${(money.outstandingCents / 100).toFixed(2)}`,
        });
      } else if (s.status !== 'picked_up') {
        open.push({ customer_name: name, reason: 'not marked picked up' });
      }
    }

    if (open.length === 0) {
      const { error: archiveError } = await supabase
        .from('animals')
        .update({ status: 'archived' })
        .eq('id', animal.id);

      if (archiveError) {
        // Never swallow this. A failing archive used to leave the date looking
        // active with no explanation anywhere.
        console.error(`Could not archive butcher date ${(animal as any).name}:`, archiveError);
        failed.push({
          id: animal.id,
          name: (animal as any).name,
          reason: archiveError.message,
        });
      } else {
        archived.push({ id: animal.id, name: (animal as any).name });
      }
    } else {
      needsAttention.push({
        id: animal.id,
        name: (animal as any).name,
        butcher_date: (animal as any).butcher_date,
        open,
      });
    }
  }

  return { archived, needsAttention, failed };
}
