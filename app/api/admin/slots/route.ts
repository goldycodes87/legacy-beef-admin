export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getConfig, getDepositAmount } from '@/lib/config';
import { summarizeReservation } from '@/lib/reservation';


export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const config = await getConfig();
    const { searchParams } = new URL(request.url);
    const animalId = searchParams.get('animal_id');

    let query = supabase
      .from('sessions')
      .select(`
        id,
        purchase_type,
        is_splitting,
        status,
        cut_sheet_complete,
        created_at,
        admin_notes,
        hanging_weight_lbs,
        balance_paid,
        balance_due,
        balance_payment_method,
        price_per_lb,
        intended_payment_method,
        discount_amount,
        discount_note,
        deposit_amount,
        customers (name, email, phone),
        animals (id, name, animal_type, butcher_date, price_per_lb),
        payments (id, type, status, amount_cents, surcharge_cents, paid_at, method, check_number)
      `)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (animalId) {
      query = query.eq('animal_id', animalId);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;

    // Real paid deposits only. Zero-dollar rows are artifacts of the
    // auto-settle job, and counting them made unpaid orders look settled.
    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: paidDeposits } = await supabase
      .from('payments')
      .select('session_id, amount_cents, method, check_number')
      .in('session_id', sessionIds)
      .eq('type', 'deposit')
      .eq('status', 'paid')
      .gt('amount_cents', 0);

    const paidSessionIds = new Set((paidDeposits || []).map((p: any) => p.session_id));

    if (animalId) {
      // Return flat array for single animal lookup
      const flat = (sessions || []).map((s: any) => ({
        id: s.id,
        customer_name: s.customers?.name || 'Unknown',
        customer_email: s.customers?.email || '',
        customer_phone: s.customers?.phone || '',
        purchase_type: s.purchase_type,
        status: s.status,
        deposit_paid: summarizeReservation(s).hasPayment,
        cut_sheet_complete: s.cut_sheet_complete,
        created_at: s.created_at,
        admin_notes: s.admin_notes || null,
        hanging_weight_lbs: s.hanging_weight_lbs || null,
        payment_method: summarizeReservation(s).depositMethod,
        check_number: summarizeReservation(s).checkNumber,
        intended_payment_method: s.intended_payment_method || null,
        discount_amount: s.discount_amount || 0,
        discount_note: s.discount_note || null,
      }));
      return NextResponse.json(flat);
    }

    // Group by animal
    const grouped = (sessions || []).reduce((acc: any, session: any) => {
      const animalName = session.animals?.name || 'Unknown';
      if (!acc[animalName]) {
        acc[animalName] = {
          animal: session.animals,
          sessions: [],
        };
      }
      // Same summary the Payments tab uses, so both screens agree.
      const money = summarizeReservation(session);

      acc[animalName].sessions.push({
        id: session.id,
        customer_name: session.customers?.name || 'Unknown',
        purchase_type: session.purchase_type,
        status: session.status,
        // Any real money received counts, however it was recorded — a customer
        // who settled in full without a separate deposit has paid.
        deposit_paid: money.hasPayment,
        cut_sheet_complete: session.cut_sheet_complete,
        created_at: session.created_at,
        price_per_lb: session.price_per_lb || session.animals?.price_per_lb || null,
        // What was quoted at booking, for reference alongside what was banked.
        deposit_amount_cents: Math.round(
          (session.deposit_amount ??
            getDepositAmount(
              config,
              session.purchase_type,
              session.is_splitting || false,
              session.animals?.animal_type
            )) * 100
        ),
        deposit_taken_cents: money.depositCents,
        order_total_cents: money.orderTotalCents,
        banked_cents: money.bankedCents,
        outstanding_cents: money.outstandingCents,
        unrecorded_settlement: money.unrecordedSettlement,
        admin_notes: session.admin_notes || null,
        hanging_weight_lbs: session.hanging_weight_lbs || null,
        balance_paid: session.balance_paid || false,
        // Derived, so a stale balance_due column cannot contradict Payments.
        balance_due: money.outstandingCents / 100,
        balance_payment_method: session.balance_payment_method || null,
        payment_method: money.depositMethod,
        check_number: money.checkNumber,
        intended_payment_method: session.intended_payment_method || null,
        discount_amount: session.discount_amount || 0,
        discount_note: session.discount_note || null,
      });
      return acc;
    }, {});

    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch slots', detail: JSON.stringify(err) }, { status: 500 });
  }
}
