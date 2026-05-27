export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Load session with customer and animal data
    const { data: session } = await supabase
      .from('sessions')
      .select(`
        id, purchase_type, access_token, price_per_lb,
        customers (id, name, email),
        animals (name, butcher_date, estimated_ready_date, price_per_lb)
      `)
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const customer = Array.isArray((session as any).customers)
      ? (session as any).customers[0]
      : (session as any).customers;
    const animal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;

    if (!customer || !animal || !(session as any).access_token) {
      return NextResponse.json(
        { error: 'Missing customer, animal, or access token' },
        { status: 400 }
      );
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { emailBase, ctaButton, orderCard } = await import('@/lib/email-templates');

      const firstName = customer.name?.split(' ')[0] ?? 'there';
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';
      const cutSheetUrl = `${APP_URL}/api/token/${(session as any).access_token}`;

      const t = (session as any).purchase_type;
      const purchaseLabel = t === 'whole' ? 'Whole Beef' : t === 'half' ? 'Half Beef' : 'Quarter Beef';

      const formatDate = (d: string | null) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD';

      const pricePerLb = parseFloat((session as any).price_per_lb) || parseFloat(animal.price_per_lb) || 0;

      const content = `
        <table role="presentation" width="100%" style="border-radius:12px;margin:0 0 28px;"><tr><td bgcolor="#1A3D2B" style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">✂️</div>
          <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
            Time to build your cut sheet, ${firstName}.
          </h2>
          <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
            Butcher date: ${formatDate(animal.butcher_date)}
          </p>
        </td></tr></table>
        <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
          We know life gets busy — but this is the fun part. Tell us exactly how you want your beef cut: steaks, roasts, ground beef, stew meat, bones for broth. It's all yours.
        </p>
        ${orderCard([
          { label: 'Order Type', value: purchaseLabel },
          { label: 'Animal', value: animal.name },
          { label: 'Price/lb', value: '$' + pricePerLb.toFixed(2) },
          { label: 'Ready by', value: formatDate(animal.estimated_ready_date) },
        ])}
        <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
          <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
            🏠 Not sure what to pick?
          </p>
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;">
            Choose our Legacy House Cut — a chef-approved selection that maximizes your beef and puts variety in your freezer.
          </p>
        </div>
        ${ctaButton('Build My Cut Sheet →', cutSheetUrl)}
        <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
          Questions? Call us at (719) 258-1777 or reply to this email.
        </p>
      `;

      await resend.emails.send({
        from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
        to: customer.email,
        subject: 'Time to build your cut sheet — Butcher date: ' + formatDate(animal.butcher_date),
        html: emailBase(content, 'Time to build your cut sheet.'),
      });

      return NextResponse.json({ success: true });
    } catch (emailErr) {
      console.error('Cut sheet email error:', emailErr);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (err) {
    console.error('Send cut sheet error:', err);
    return NextResponse.json({ error: 'Failed to send cut sheet email' }, { status: 500 });
  }
}
