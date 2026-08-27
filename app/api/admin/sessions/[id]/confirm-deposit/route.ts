export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/push';
import { sendAdminSms } from '@/lib/sms';
import { getConfig, getDepositAmount } from '@/lib/config';
import { build, depositConfirmation } from '@/lib/email-content';

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

    // Confirming twice would credit the deposit twice and re-email the customer.
    const { data: existingDeposit } = await supabase
      .from('payments')
      .select('id')
      .eq('session_id', id)
      .eq('type', 'deposit')
      .eq('status', 'paid')
      .gt('amount_cents', 0)
      .maybeSingle();

    if (existingDeposit) {
      return NextResponse.json(
        { error: 'A deposit is already recorded for this reservation.' },
        { status: 409 }
      );
    }

    const allowedMethods = ['cash', 'check', 'card'];
    if (method && !allowedMethods.includes(String(method).toLowerCase())) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${allowedMethods.join(', ')}.` },
        { status: 400 }
      );
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

          // Cash and check customers never went through the card flow, so they
          // have no access token yet. Without one this email's only call to
          // action would drop them on the home page.
          let accessToken = (fullSession as any).access_token;
          if (!accessToken) {
            const { createAccessToken } = await import('@/lib/access-token');
            const butcherDate = animal.butcher_date
              ? new Date(new Date(animal.butcher_date).getTime() + 60 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 150 * 24 * 60 * 60 * 1000);
            accessToken = await createAccessToken(id, butcherDate);
          }
          const cutSheetUrl = `${APP_URL}/api/token/${accessToken}`;

          const t = (fullSession as any).purchase_type;
          const purchaseLabel = t === 'whole' ? 'Whole Beef' : t === 'half' ? 'Half Beef' : 'Quarter Beef';
          const customerName = customer.name || 'Customer';

          const formatDate = (d: string | null) => d
            ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'TBD';

          const pricePerLb = parseFloat((fullSession as any).price_per_lb) ||
            parseFloat(animal.price_per_lb) || 0;
          const depositPaid = depositCents / 100;

          // Shared with the portal's card-payment path and with the admin
          // preview, so a cash customer and a card customer get the same email.
          const { subject: depositSubject, html: depositHtml } = build(depositConfirmation, {
            firstName,
            purchaseLabel,
            animalName: animal.name,
            butcherDate: formatDate(animal.butcher_date),
            estimatedReady: animal.estimated_ready_date ? formatDate(animal.estimated_ready_date) : null,
            pricePerLb,
            depositPaid,
            cutSheetUrl,
          });

          // Send customer confirmation email
          await resend.emails.send({
            from: 'Legacy Land & Cattle <orders@legacylandandcattleco.com>',
            to: customer.email,
            subject: depositSubject,
            html: depositHtml,
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
    await sendAdminSms(`💰 Deposit confirmed: ${customerName} (${method}) — ${purchaseLabel}`);
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
