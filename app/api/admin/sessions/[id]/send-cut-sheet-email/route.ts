export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { build, cutSheetInvite } from '@/lib/email-content';

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
        id, purchase_type, access_token, access_token_expires_at, price_per_lb,
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

    if (!customer || !animal) {
      return NextResponse.json({ error: 'Missing customer or animal' }, { status: 400 });
    }

    // Same link the customer already has, kept open long enough to use.
    const { ensureAccessToken, linkLifetime } = await import('@/lib/access-token');
    const accessToken = await ensureAccessToken(id, session as any, 60, linkLifetime(animal.butcher_date));

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { emailBase, ctaButton, orderCard } = await import('@/lib/email-templates');

      const firstName = customer.name?.split(' ')[0] ?? 'there';
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';
      const cutSheetUrl = `${APP_URL}/api/token/${accessToken}`;

      const t = (session as any).purchase_type;
      const purchaseLabel = t === 'whole' ? 'Whole Beef' : t === 'half' ? 'Half Beef' : 'Quarter Beef';

      const formatDate = (d: string | null) => d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD';

      const pricePerLb = parseFloat((session as any).price_per_lb) || parseFloat(animal.price_per_lb) || 0;

      const { subject, html } = build(cutSheetInvite, {
        firstName,
        purchaseLabel,
        animalName: animal.name,
        butcherDate: formatDate(animal.butcher_date),
        estimatedReady: animal.estimated_ready_date ? formatDate(animal.estimated_ready_date) : null,
        pricePerLb,
        cutSheetUrl,
      });

      // Resend reports failures in the result rather than throwing.
      const { error: sendError } = await resend.emails.send({
        from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
        to: customer.email,
        subject,
        html,
      });
      if (sendError) {
        console.error('Cut sheet email rejected:', sendError);
        return NextResponse.json({ error: `Email not sent: ${sendError.message}` }, { status: 502 });
      }

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
