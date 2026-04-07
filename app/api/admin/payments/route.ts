export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, type, status, amount_cents, paid_at, stripe_payment_intent_id,
      session_id,
      sessions(
        id, purchase_type, deposit_amount, balance_due, balance_paid,
        balance_payment_method, status,
        customers(name, email, phone),
        animals(name, butcher_date, animal_type)
      )
    `)
    .order('paid_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // FIX 1: Filter out payments linked to cancelled sessions
  const filtered = (data || []).filter((p: any) => p.sessions?.status !== 'cancelled');

  // FIX 2: Build set of session IDs with paid deposits (from payments table)
  const { data: deposits } = await supabase
    .from('payments')
    .select('session_id')
    .eq('type', 'deposit')
    .eq('status', 'paid');

  const paidSessionIds = new Set(deposits?.map((d: any) => d.session_id) || []);

  // Add deposit_paid to each session object
  const result = filtered.map((p: any) => ({
    ...p,
    sessions: p.sessions ? {
      ...p.sessions,
      deposit_paid: paidSessionIds.has(p.sessions.id),
    } : null,
  }));

  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { session_id, method } = body;

  await supabase
    .from('sessions')
    .update({
      balance_paid: true,
      balance_paid_at: new Date().toISOString(),
      balance_payment_method: method,
      status: 'paid_in_full',
    })
    .eq('id', session_id);

  return NextResponse.json({ success: true });
}
