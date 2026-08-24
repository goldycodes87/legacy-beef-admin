export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { build, hangingWeight as hangingWeightEmail } from '@/lib/email-content';
import { sendPushNotification } from '@/lib/push';
import { computeBalance } from '@/lib/money';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';

/** A carcass outside this range is a typo, not a weight. */
const MIN_HANGING_WEIGHT_LBS = 50;
const MAX_HANGING_WEIGHT_LBS = 1200;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const { hanging_weight_lbs } = await request.json();

  // The balance is computed here from the payments table and the session's
  // discount. It is never taken from the request body — this figure is emailed
  // to the customer as what they owe.
  const weight = Number(hanging_weight_lbs);
  if (!Number.isFinite(weight) || weight < MIN_HANGING_WEIGHT_LBS || weight > MAX_HANGING_WEIGHT_LBS) {
    return NextResponse.json(
      {
        error: `Hanging weight must be between ${MIN_HANGING_WEIGHT_LBS} and ${MAX_HANGING_WEIGHT_LBS} lbs.`,
        detail: `Received: ${hanging_weight_lbs}`,
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('sessions')
    .update({ hanging_weight_lbs: weight })
    .eq('id', id);

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  // Load session + customer + animal for email
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, is_splitting, access_token, price_per_lb, discount_amount, discount_note,
      customers (id, name, email),
      animals (name, butcher_date),
      payments (amount_cents, surcharge_cents, type, status)
    `)
    .eq('id', id)
    .single();

  if (session) {
    const customer = Array.isArray((session as any).customers)
      ? (session as any).customers[0]
      : (session as any).customers;
    const animal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;
    const payments = (session as any).payments || [];

    if (customer && animal) {
      const firstName = customer.name?.split(' ')[0] ?? 'there';
      const pricePerLb = parseFloat((session as any).price_per_lb) || parseFloat(animal?.price_per_lb) || 0;

      const { totalCost, depositCredit: depositPaid, balanceDue } = computeBalance({
        hangingWeightLbs: weight,
        pricePerLb,
        payments,
        discountAmount: (session as any).discount_amount,
      });

      await supabase.from('sessions')
        .update({ balance_due: balanceDue })
        .eq('id', id);

      const purchaseLabel =
        (session as any).purchase_type === 'whole'
          ? 'Whole Beef'
          : (session as any).purchase_type === 'half'
            ? 'Half Beef'
            : 'Quarter Beef';

      const accessToken = (session as any).access_token;
      // /api/token/<token> is the only route that consumes an access token: it
      // verifies it, sets the access cookie, and forwards to the right page.
      const payLink = accessToken
        ? `${APP_URL}/api/token/${accessToken}`
        : `${APP_URL}`;

      const { subject, html } = build(hangingWeightEmail, {
        firstName,
        purchaseLabel,
        hangingWeight: weight,
        pricePerLb,
        totalCost,
        depositPaid,
        balanceDue,
        payUrl: payLink,
        discountAmount: (session as any).discount_amount || 0,
        discountNote: (session as any).discount_note || null,
      });

      await sendPushNotification(
        '⚖️ Hanging Weight Entered',
        `${purchaseLabel} — ${weight} lbs — Balance: $${balanceDue.toFixed(2)}`,
        '/slots'
      );

      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
          to: customer.email,
          subject,
          html,
        });
      } catch (emailErr) {
        console.error('Hanging weight email error:', emailErr);
      }
    }
  }

  return NextResponse.json({ success: true });
}
