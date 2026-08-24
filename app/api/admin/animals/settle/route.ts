export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

interface OpenItem {
  customer_name: string;
  reason: string;
}

/**
 * Closes out butcher dates that are behind us.
 *
 * A date is finished when every reservation on it has been picked up and has
 * no money outstanding. Those archive themselves. Anything past its butcher
 * date with loose ends is returned so the page can say what is still open,
 * rather than quietly hiding an unpaid order.
 */
export async function POST() {
  try {
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

    const archived: { id: string; name: string }[] = [];
    const needsAttention: { id: string; name: string; butcher_date: string; open: OpenItem[] }[] = [];

    for (const animal of animals || []) {
      const sessions = ((animal as any).sessions || []).filter(
        (s: any) => s.status !== 'cancelled' && s.status !== 'draft'
      );

      const open: OpenItem[] = [];

      for (const s of sessions) {
        const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
        const name = customer?.name || 'Unknown customer';

        const paid = (s.payments || []).filter(
          (p: any) => p.status === 'paid' && (p.amount_cents || 0) > 0
        );
        const bankedCents = paid.reduce(
          (sum: number, p: any) => sum + ((p.amount_cents || 0) - (p.surcharge_cents || 0)),
          0
        );

        const { totalCost } = computeBalance({
          hangingWeightLbs: s.hanging_weight_lbs,
          pricePerLb: s.price_per_lb,
          payments: [],
          discountAmount: 0,
        });
        const discount = Number(s.discount_amount) || 0;
        const orderTotalCents = Math.max(0, Math.round((totalCost - discount) * 100));
        const outstandingCents = orderTotalCents > 0 ? orderTotalCents - bankedCents : 0;

        if (outstandingCents > 0) {
          open.push({ customer_name: name, reason: `owes $${(outstandingCents / 100).toFixed(2)}` });
        } else if (!s.balance_paid && orderTotalCents > 0) {
          open.push({ customer_name: name, reason: 'balance not marked paid' });
        } else if (orderTotalCents === 0) {
          open.push({ customer_name: name, reason: 'no hanging weight entered' });
        } else if (s.status !== 'picked_up') {
          open.push({ customer_name: name, reason: 'not picked up' });
        }
      }

      if (open.length === 0) {
        const { error: archiveError } = await supabase
          .from('animals')
          .update({ status: 'archived' })
          .eq('id', animal.id);
        if (!archiveError) archived.push({ id: animal.id, name: (animal as any).name });
      } else {
        needsAttention.push({
          id: animal.id,
          name: (animal as any).name,
          butcher_date: (animal as any).butcher_date,
          open,
        });
      }
    }

    return NextResponse.json({ archived, needs_attention: needsAttention });
  } catch (err) {
    console.error('Settle butcher dates error:', err);
    return NextResponse.json(
      { error: 'Could not check past butcher dates', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
