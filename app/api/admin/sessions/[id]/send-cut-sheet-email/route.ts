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
      const { emailBase, ctaButton } = await import('@/lib/email-templates');

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
        <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Hi ${firstName},
        </p>
        <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
          Ready to build your cut sheet? Tell the butcher exactly how you want your ${purchaseLabel} cut — steaks, roasts, ground beef, organ meats, bones for broth. This is your call.
        </p>
        <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">
          <strong style="color:#1A3D2B;">Your order:</strong>
        </p>
        <ul style="color:#374151;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;margin:0 0 24px;">
          <li><strong>${purchaseLabel}</strong> from ${animal.name}</li>
          <li>Butcher date: ${formatDate(animal.butcher_date)}</li>
          <li>Ready: ${formatDate(animal.estimated_ready_date)}</li>
          <li>$${pricePerLb.toFixed(2)}/lb</li>
        </ul>
        ${ctaButton('Build My Cut Sheet →', cutSheetUrl)}
        <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:8px;">
          This is your personal link — keep it safe. You can come back anytime before the butcher date.
        </p>
      `;

      await resend.emails.send({
        from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
        to: customer.email,
        subject: 'Build Your Cut Sheet — Your Beef is Coming',
        html: emailBase(content, 'Time to tell us how to cut your beef.'),
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
