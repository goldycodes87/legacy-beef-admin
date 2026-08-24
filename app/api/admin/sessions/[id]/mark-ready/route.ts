export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

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
  const purchaseLabel = session.purchase_type.charAt(0).toUpperCase() + session.purchase_type.slice(1);

  let balanceSection = '';
  if (balanceToStore > 0) {
    balanceSection = `
      <p style="margin: 20px 0; color: #d97706; font-weight: bold;">
        Balance Due: <span style="font-size: 18px;">$${balanceToStore.toFixed(2)}</span>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td align="center">
            <a href="${APP_URL}/session/${id}/balance" style="background-color: #E85D24; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Pay Balance Online → $${balanceToStore.toFixed(2)}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial; background-color: #f5f0e8; margin: 0; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px;">
    <tr>
      <td style="background-color: #2D5016; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Your Beef is Ready! 🎉</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px;">
        <p>Great news, <strong>${firstName}</strong>!</p>
        <p>Your <strong>${purchaseLabel}</strong> beef is back from the butcher and ready for pickup.</p>
        
        <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p><strong>${animal.name}</strong></p>
          <p>Hanging Weight: <strong>${session.hanging_weight_lbs ? session.hanging_weight_lbs + ' lbs' : 'TBD'}</strong></p>
          <p>Price: <strong>$${session.price_per_lb ? session.price_per_lb.toFixed(2) : '8.25'}/lb</strong></p>
        </div>

        ${balanceSection}

        <p style="margin: 20px 0;">Next step: choose your pickup time.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td align="center">
              <a href="${APP_URL}/api/token/${accessToken}" style="background-color: #2D5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Schedule My Pickup →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await resend.emails.send({
    from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
    to: customer.email,
    subject: `Your beef is ready for pickup! 🎉`,
    html: htmlBody,
  }).catch((err: any) => console.error('Resend error:', err));

  return NextResponse.json({ success: true });
}
