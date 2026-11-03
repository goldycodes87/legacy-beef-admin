import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { build, balanceReminder } from '@/lib/email-content';
import { summarizeReservation } from '@/lib/reservation';
import { ensureAccessToken } from '@/lib/access-token';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';

/**
 * Emails one customer a friendly balance reminder with a pay link.
 *
 * Lives here rather than in the route so a scheduled job can send the same
 * reminder later without going through HTTP. The figure emailed is derived
 * from the payments table — never the stored balance_due column.
 */
export async function sendPaymentReminder(
  sessionId: string
): Promise<{ error: string } | { sent_to: string; customer: string; balance_due: number }> {
  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, status, balance_paid, hanging_weight_lbs,
      price_per_lb, discount_amount, discount_note,
      access_token, access_token_expires_at, balance_reminder_sent_at,
      customers (id, name, email),
      animals (name, butcher_date, price_per_lb),
      payments (type, amount_cents, surcharge_cents, status)
    `)
    .eq('id', sessionId)
    .single();

  if (!session) return { error: 'Order not found.' };

  const s = session as any;
  if (s.balance_paid || s.status === 'picked_up' || s.status === 'cancelled') {
    return { error: 'This order is already settled — nothing to remind about.' };
  }
  if (!s.hanging_weight_lbs) {
    return { error: 'No hanging weight yet, so there is no balance to remind about.' };
  }

  const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
  if (!customer?.email) return { error: 'This customer has no email address on file.' };

  const money = summarizeReservation(s);
  if (money.outstandingCents <= 0) {
    return { error: 'Nothing is outstanding on this order.' };
  }

  const animal = Array.isArray(s.animals) ? s.animals[0] : s.animals;
  const pricePerLb = parseFloat(s.price_per_lb) || parseFloat(animal?.price_per_lb) || 0;
  const purchaseLabel =
    s.purchase_type === 'whole' ? 'Whole Beef' : s.purchase_type === 'half' ? 'Half Beef' : 'Quarter Beef';

  // /api/token/<token> verifies the token, sets the access cookie, and lands
  // the customer on the right page — the same link the weigh-in email uses.
  const accessToken = await ensureAccessToken(sessionId, s);
  const payUrl = `${APP_URL}/api/token/${accessToken}`;

  const { subject, html } = build(balanceReminder, {
    firstName: customer.name?.split(' ')[0] ?? 'there',
    purchaseLabel,
    hangingWeight: Number(s.hanging_weight_lbs),
    pricePerLb,
    totalCost: (money.orderTotalCents + Math.max(0, Math.round((Number(s.discount_amount) || 0) * 100))) / 100,
    paidSoFar: money.bankedCents / 100,
    discountAmount: Number(s.discount_amount) || 0,
    discountNote: s.discount_note || null,
    balanceDue: money.outstandingCents / 100,
    payUrl,
  });

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
      to: customer.email,
      subject,
      html,
    });
    if (sendError) return { error: `Email failed to send: ${sendError.message}` };
  } catch (err) {
    return { error: `Email failed to send: ${err instanceof Error ? err.message : 'unknown error'}` };
  }

  await supabase
    .from('sessions')
    .update({ balance_reminder_sent_at: new Date().toISOString() })
    .eq('id', sessionId);

  return {
    sent_to: customer.email,
    customer: customer.name,
    balance_due: money.outstandingCents / 100,
  };
}
