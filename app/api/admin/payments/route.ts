export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  // Query sessions table for all non-cancelled sessions with deposit_paid or higher
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, status, balance_due, balance_paid,
      balance_paid_at, balance_payment_method, price_per_lb,
      hanging_weight_lbs,
      customers(name, email),
      animals(name, butcher_date)
    `)
    .not('status', 'eq', 'cancelled')
    .in('status', ['deposit_paid', 'in_progress', 'locked', 'beef_ready', 'completed'])
    .order('status', { ascending: false });

  if (!sessions) return NextResponse.json([]);

  // For each session, fetch related payments
  const { data: allPayments } = await supabase
    .from('payments')
    .select('session_id, type, status, amount_cents, paid_at, method')
    .in('session_id', sessions.map(s => s.id));

  const paymentsMap = new Map();
  allPayments?.forEach(p => {
    if (!paymentsMap.has(p.session_id)) {
      paymentsMap.set(p.session_id, {});
    }
    const key = `${p.type}`;
    paymentsMap.get(p.session_id)[key] = p;
  });

  // Build response
  const result = sessions.map(session => {
    const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
    const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
    const payments = paymentsMap.get(session.id) || {};
    const deposit = payments['deposit'];

    return {
      session_id: session.id,
      customer_name: customer?.name || 'Unknown',
      animal_name: animal?.name || 'Unknown',
      butcher_date: animal?.butcher_date,
      purchase_type: session.purchase_type,
      deposit_amount_cents: deposit?.amount_cents || null,
      deposit_paid_at: deposit?.paid_at || null,
      deposit_method: deposit?.method || null,
      balance_due: session.balance_due || 0,
      balance_paid: session.balance_paid || false,
      balance_paid_at: session.balance_paid_at || null,
      balance_payment_method: session.balance_payment_method || null,
      price_per_lb: session.price_per_lb,
      hanging_weight_lbs: session.hanging_weight_lbs,
    };
  });

  return NextResponse.json(result);
}
