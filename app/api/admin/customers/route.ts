export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id, name, email, phone, address, city, state, zip, created_at,
      sessions(id, purchase_type, status, status, created_at,
        animals(name, butcher_date, animal_type))
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get all paid deposits for all sessions across all customers
  const allSessionIds = (data || []).flatMap((c: any) =>
    (c.sessions || []).map((s: any) => s.id)
  );

  const { data: paidDeposits } = await supabase
    .from('payments')
    .select('session_id')
    .in('session_id', allSessionIds)
    .eq('type', 'deposit')
    .eq('status', 'paid');

  const paidSet = new Set((paidDeposits || []).map((p: any) => p.session_id));

  // Enrich each session with deposit_paid from payments table
  const enriched = (data || []).map((customer: any) => ({
    ...customer,
    sessions: (customer.sessions || []).map((s: any) => ({
      ...s,
      deposit_paid: paidSet.has(s.id),
    }))
  }));

  return NextResponse.json(enriched);
}
