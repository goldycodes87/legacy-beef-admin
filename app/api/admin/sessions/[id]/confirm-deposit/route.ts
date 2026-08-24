export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/push';
import { getConfig, getDepositAmount } from '@/lib/config';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const { method, check_number } = await request.json();

    // Load session
    const { data: session } = await supabase
      .from('sessions')
      .select('id, purchase_type, animal_id, is_splitting, price_per_lb, access_token, deposit_amount, animals (animal_type)')
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // The deposit quoted at booking is what we record; otherwise fall back to
    // the config matrix. Never a hardcoded figure.
    const sessionAnimal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;
    const depositDollars =
      (session as any).deposit_amount ??
      getDepositAmount(
        await getConfig(),
        session.purchase_type,
        session.is_splitting || false,
        sessionAnimal?.animal_type
      );
    const depositCents = Math.round(depositDollars * 100);

    // Insert payment record
    await supabase.from('payments').insert({
      session_id: id,
      type: 'deposit',
      method: method || 'cash',
      amount_cents: depositCents,
      status: 'paid',
      paid_at: new Date().toISOString(),
      check_number: check_number || null,
    });

    // Update session status
    await supabase.from('sessions')
      .update({ status: 'deposit_paid' })
      .eq('id', id);

    // Load full session data for email
    const { data: fullSession } = await supabase
      .from('sessions')
      .select(`
        id, purchase_type, price_per_lb,
        customers (id, name, email),
        animals (name, butcher_date, estimated_ready_date, price_per_lb)
      `)
      .eq('id', id)
      .single();

    if (fullSession) {
      const customer = Array.isArray((fullSession as any).customers)
        ? (fullSession as any).customers[0]
        : (fullSession as any).customers;
      const animal = Array.isArray((fullSession as any).animals)
        ? (fullSession as any).animals[0]
        : (fullSession as any).animals;

      if (customer && animal) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { emailBase, ctaButton, orderCard } = await import('@/lib/email-templates');

          const firstName = customer.name?.split(' ')[0] ?? 'there';
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.legacylandandcattleco.com';
          const accessToken = (fullSession as any).access_token;
          const cutSheetUrl = accessToken
            ? `${APP_URL}/api/token/${accessToken}`
            : `${APP_URL}`;

          const t = (fullSession as any).purchase_type;
          const purchaseLabel = t === 'whole' ? 'Whole Beef' : t === 'half' ? 'Half Beef' : 'Quarter Beef';
          const customerName = customer.name || 'Customer';

          const formatDate = (d: string | null) => d
            ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'TBD';

          const pricePerLb = parseFloat((fullSession as any).price_per_lb) ||
            parseFloat(animal.price_per_lb) || 0;
          const depositPaid = depositCents / 100;

          const content = `
            <table role="presentation" width="100%" style="border-radius:12px;margin:0 0 28px;">
              <tr><td bgcolor="#1A3D2B" style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;">
                <div style="font-size:40px;margin-bottom:8px;">🎉</div>
                <h2 style="font-family:Georgia,serif;color:white;font-size:26px;margin:0 0 8px;font-weight:normal;">
                  You're in, ${firstName}.
                </h2>
                <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
                  Your spot is locked. Your beef is coming.
                </p>
              </td></tr>
            </table>
            <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
              We've got your deposit and your reservation is officially on the books.
              This is real, ranch-direct beef raised right here in Colorado Springs —
              no grocery store, no middleman. Just our cattle, our butcher, and your freezer.
            </p>
            ${orderCard([
              { label: 'Order Type', value: purchaseLabel },
              { label: 'Animal', value: animal.name },
              { label: 'Butcher Date', value: formatDate(animal.butcher_date) },
              { label: 'Est. Ready', value: formatDate(animal.estimated_ready_date) },
              { label: 'Price/lb', value: `$${pricePerLb.toFixed(2)}` },
              { label: 'Deposit Paid', value: `$${depositPaid.toFixed(2)}` },
            ])}
            <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">
              <strong style="color:#1A3D2B;">Your next step:</strong> Fill out your cut sheet —
              that's where you tell the butcher exactly how you want your beef cut.
            </p>
            ${ctaButton('Build My Cut Sheet →', cutSheetUrl)}
            <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:8px;">
              This link is yours — bookmark it for easy access anytime.
            </p>
          `;

          // Send customer confirmation email
          await resend.emails.send({
            from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
            to: customer.email,
            subject: 'Your Legacy Land & Cattle Reservation is Confirmed',
            html: emailBase(content, 'Your spot is locked. Your beef is coming.'),
          });

          // Send Grant notification email
          await resend.emails.send({
            from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
            to: 'orders@legacylandandcattleco.com',
            subject: `New Order (${method === 'check' ? 'Check' : 'Cash'}): ${purchaseLabel} — ${customer.name}`,
            html: `<ul>
              <li><strong>Customer:</strong> ${customer.name} (${customer.email})</li>
              <li><strong>Order:</strong> ${purchaseLabel}</li>
              <li><strong>Animal:</strong> ${animal.name}</li>
              <li><strong>Deposit:</strong> $${depositPaid.toFixed(2)} (${method === 'check' ? 'Check #' + (check_number || 'TBD') : 'Cash'})</li>
            </ul>`,
          });

          // Log notification
          await supabase.from('notifications').insert({
            session_id: id,
            type: 'payment_confirmation',
            channel: 'email',
            sent_at: new Date().toISOString(),
            status: 'sent',
          });

          await sendPushNotification(
            '💰 Deposit Received',
            `${purchaseLabel} deposit confirmed for ${customerName}`,
            '/slots'
          );
        } catch (emailErr) {
          console.error('Deposit confirmation email error:', emailErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Confirm deposit error:', err);
    return NextResponse.json({ error: 'Failed to confirm deposit' }, { status: 500 });
  }
}
