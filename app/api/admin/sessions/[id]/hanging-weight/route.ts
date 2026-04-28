export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const { hanging_weight_lbs, balance_due } = await request.json();

  const { error } = await supabase.from('sessions')
    .update({ hanging_weight_lbs, balance_due })
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
      id, purchase_type, access_token, price_per_lb,
      customers (id, name, email),
      animals (name, butcher_date),
      payments (amount_cents, type, status)
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
      const totalCost = hanging_weight_lbs * pricePerLb;
      const depositMap: Record<string, number> = {
        whole: 850,
        half: 500,
        quarter: 250,
      };
      const depositPaid = depositMap[(session as any).purchase_type] || 500;
      const balanceDue = balance_due || Math.max(0, totalCost - depositPaid);

      const purchaseLabel =
        (session as any).purchase_type === 'whole'
          ? 'Whole Beef'
          : (session as any).purchase_type === 'half'
            ? 'Half Beef'
            : 'Quarter Beef';

      const accessToken = (session as any).access_token;
      const payLink = accessToken
        ? `${APP_URL}/access/${accessToken}`
        : `${APP_URL}`;

      const emailHtml = buildHangingWeightEmail({
        firstName,
        purchaseLabel,
        hangingWeight: hanging_weight_lbs,
        pricePerLb,
        totalCost,
        depositPaid,
        balanceDue,
        payLink,
      });

      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
          to: customer.email,
          subject: `Your hanging weight is in, ${firstName} — here's your balance`,
          html: emailHtml,
        });
      } catch (emailErr) {
        console.error('Hanging weight email error:', emailErr);
      }
    }
  }

  return NextResponse.json({ success: true });
}

interface HangingWeightEmailParams {
  firstName: string;
  purchaseLabel: string;
  hangingWeight: number;
  pricePerLb: number;
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  payLink: string;
}

function buildHangingWeightEmail(p: HangingWeightEmailParams): string {
  const COLORS = {
    GREEN: '#1A3D2B',
    ORANGE: '#E85D24',
    DARK: '#0F0F0F',
    GOLD: '#C4A46B',
  };

  const orderRows = [
    { label: 'Order', value: p.purchaseLabel },
    { label: 'Hanging Weight', value: `${p.hangingWeight} lbs` },
    { label: 'Price Per Lb', value: `$${p.pricePerLb.toFixed(2)}/lb` },
    { label: 'Total Cost', value: `$${p.totalCost.toFixed(2)}` },
    { label: 'Deposit Paid', value: `-$${p.depositPaid.toFixed(2)}` },
    { label: 'Balance Due', value: `$${p.balanceDue.toFixed(2)}`, highlight: true },
  ];

  const rows = orderRows
    .map(
      (r) => `
    <tr>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;font-size:13px;color:#666;font-family:Arial,sans-serif;width:45%;">
        ${r.label}
      </td>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;font-size:13px;font-weight:${r.highlight ? 'bold' : 'normal'};color:${r.highlight ? COLORS.ORANGE : COLORS.DARK};font-family:Arial,sans-serif;">
        ${r.value}
      </td>
    </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your Hanging Weight</title>
</head>
<body style="background-color:#F5F0E8;margin:0;padding:20px;font-family:Arial,sans-serif;">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;">
    <tr><td style="padding:20px;">
      <table role="presentation" style="width:100%;background:white;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
        <tr>
          <td style="background-color:${COLORS.GREEN};padding:40px 20px;text-align:center;">
            <img src="https://www.legacylandandcattleco.com/images/LLC_Logo_white.svg" alt="Legacy Land & Cattle" width="160" style="width:160px;height:auto;display:block;margin:0 auto 16px;" />
            <p style="color:${COLORS.GOLD};font-size:12px;margin:0;font-family:Arial,sans-serif;letter-spacing:1px;">
              Ranch Direct · Colorado Springs, CO
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;color:${COLORS.DARK};font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
            <div style="background:linear-gradient(135deg,${COLORS.GREEN} 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
              <div style="font-size:40px;margin-bottom:8px;">⚖️</div>
              <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
                Your hanging weight is in, ${p.firstName}.
              </h2>
              <p style="color:${COLORS.GOLD};font-size:14px;margin:0;font-family:Arial,sans-serif;">
                Here's your final balance.
              </p>
            </div>
            <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Your beef has been harvested and weighed. This is the final hanging weight — the number your balance is calculated from. Everything looks great.
            </p>
            <table role="presentation" style="width:100%;background:#F9F6F1;border-radius:12px;border:1px solid #E5E0D8;margin:0 0 24px;">
              ${rows}
            </table>
            <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
              You can pay your balance now online, or bring payment when you pick up your beef — cash, check, or card all work.
            </p>
            <table role="presentation" style="width:100%;margin:0 0 12px;">
              <tr><td style="padding:0 0 12px;">
                <a href="${p.payLink}" style="display:block;background:${COLORS.ORANGE};color:white;text-align:center;padding:16px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">
                  Pay My Balance Now →
                </a>
              </td></tr>
              <tr><td>
                <a href="${p.payLink}" style="display:block;background:#F5F0E8;color:${COLORS.GREEN};text-align:center;padding:16px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid ${COLORS.GREEN};">
                  I'll Pay at Pickup
                </a>
              </td></tr>
            </table>
            <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:16px;">
              Questions? Call us at (719) 258-1777 or reply to this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F9F6F1;padding:30px 20px;text-align:center;border-top:1px solid #E5E0D8;">
            <p style="font-size:12px;color:#666;margin:0 0 8px;font-family:Arial,sans-serif;">
              <strong>Legacy Land & Cattle</strong><br>
              Colorado Springs, CO
            </p>
            <p style="font-size:12px;color:#666;margin:0;font-family:Arial,sans-serif;">
              <a href="mailto:orders@legacylandandcattleco.com" style="color:${COLORS.ORANGE};text-decoration:none;">
                orders@legacylandandcattleco.com
              </a><br>
              <a href="tel:+17192581777" style="color:${COLORS.ORANGE};text-decoration:none;">
                (719) 258-1777
              </a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
