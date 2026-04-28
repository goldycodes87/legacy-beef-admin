export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { emailBase, ctaButton, orderCard } from '@/lib/email-templates';

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
      id, purchase_type, is_splitting, access_token, price_per_lb,
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
      const t = (session as any).purchase_type;
      const s = (session as any).is_splitting;
      const depositPaid = (t === 'whole' && !s) ? 850 : (t === 'whole' && s) ? 500 : (t === 'half' && s) ? 250 : (t === 'half') ? 500 : 250;
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
  const content = `
    <table role="presentation" width="100%" style="border-radius:12px;margin:0 0 28px;">
    <tr><td bgcolor="#1A3D2B" style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">&#9878;</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Your hanging weight is in, ${p.firstName}.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;">
        Here's your final balance.
      </p>
    </td></tr></table>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Your beef has been harvested and weighed. This is the final hanging weight —
      the number your balance is calculated from. Everything looks great.
    </p>
    ${orderCard([
      { label: 'Order', value: p.purchaseLabel },
      { label: 'Hanging Weight', value: `${p.hangingWeight} lbs` },
      { label: 'Price Per Lb', value: `$${p.pricePerLb.toFixed(2)}/lb` },
      { label: 'Total Cost', value: `$${p.totalCost.toFixed(2)}` },
      { label: 'Deposit Paid', value: `-$${p.depositPaid.toFixed(2)}` },
      { label: 'Balance Due', value: `$${p.balanceDue.toFixed(2)}` },
    ])}
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      You can pay your balance now online, or bring payment at pickup —
      cash, check, or card all work.
    </p>
    ${ctaButton('Pay My Balance Now \u2192', p.payLink)}
    <a href="${p.payLink}" style="display:block;background:#F5F0E8;color:#1A3D2B;
      text-align:center;padding:16px 24px;border-radius:10px;font-family:Arial,sans-serif;
      font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;
      margin:12px 0 8px;">
      I'll Pay at Pickup
    </a>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:16px;">
      Questions? Call us at (719) 258-1777 or reply to this email.
    </p>
  `;
  return emailBase(content, `Your hanging weight is in, ${p.firstName} — here's your balance`);
}
