export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';
import { build, beefReady } from '@/lib/email-content';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;

  // Load session + customer + animal + payments
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(`
      id, status, hanging_weight_lbs, price_per_lb, is_splitting, purchase_type, access_token,
      discount_amount, balance_due, balance_paid,
      customers(id, name, email),
      animals(id, name, butcher_date),
      payments(id, amount_cents, surcharge_cents, type, status, paid_at)
    `)
    .eq('id', id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
  const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;

  // Recompute through the shared calculator so the discount is honoured and
  // the card surcharge is not credited against the beef. Previously this
  // recomputed without the discount term and silently re-billed customers who
  // had been given one.
  const { balanceDue } = computeBalance({
    hangingWeightLbs: session.hanging_weight_lbs,
    pricePerLb: session.price_per_lb,
    payments: session.payments,
    discountAmount: (session as any).discount_amount,
  });

  // A settled balance stays settled.
  const balanceToStore = (session as any).balance_paid ? 0 : balanceDue;

  await supabase
    .from('sessions')
    .update({
      status: 'beef_ready',
      beef_ready_at: new Date().toISOString(),
      balance_due: balanceToStore,
    })
    .eq('id', id);

  // Generate fresh access token if needed
  let accessToken = session.access_token;
  if (!accessToken) {
    const { createAccessToken } = await import('@/lib/access-token');
    accessToken = await createAccessToken(id, new Date(animal.butcher_date));
  }

  // Send email via Resend
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const firstName = customer.name?.split(' ')[0] || 'there';

  // This route used to hand-roll its own unbranded HTML — wrong green, no
  // shared shell, and a hardcoded $8.25/lb whenever a session had no price.
  // The template is shared with the preview now, so what you see is what sends.
  const pricePerLb = session.price_per_lb ?? 0;
  const hangingWeight = session.hanging_weight_lbs ?? null;
  const depositPaid = (session.payments || [])
    .filter((x: any) => x.status === 'paid' && x.type !== 'balance')
    .reduce((sum: number, x: any) => sum + (x.amount_cents - (x.surcharge_cents || 0)), 0) / 100;

  const { subject, html: htmlBody } = build(beefReady, {
    firstName,
    hangingWeight,
    pricePerLb,
    totalCost: (hangingWeight || 0) * pricePerLb,
    depositPaid,
    balanceDue: balanceToStore,
    pickupUrl: `${APP_URL}/api/token/${accessToken}`,
  });

  await resend.emails.send({
    from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
    to: customer.email,
    subject,
    html: htmlBody,
  }).catch((err: any) => console.error('Resend error:', err));

  return NextResponse.json({ success: true });
}
