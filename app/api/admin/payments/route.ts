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
        balance_payment_method,
        customers(name, email, phone),
        animals(name, butcher_date, animal_type)
      )
    `)
    .order('paid_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
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
