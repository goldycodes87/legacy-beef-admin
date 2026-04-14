export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id, name, email, phone, address, city, state, zip, created_at, archived_at,
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

  // Get all customer links for all customers
  const customerIds = (data || []).map((c: any) => c.id);
  const { data: allLinks } = await supabase
    .from('customer_links')
    .select('*')
    .or(
      customerIds
        .map((id: string) => `customer_id_a.eq.${id},customer_id_b.eq.${id}`)
        .join(',')
    );

  const linksMap = new Map<string, any[]>();
  (allLinks || []).forEach((link: any) => {
    if (!linksMap.has(link.customer_id_a)) {
      linksMap.set(link.customer_id_a, []);
    }
    if (!linksMap.has(link.customer_id_b)) {
      linksMap.set(link.customer_id_b, []);
    }
    linksMap.get(link.customer_id_a)?.push(link);
    linksMap.get(link.customer_id_b)?.push(link);
  });

  // Enrich each session with deposit_paid from payments table
  const enriched = (data || []).map((customer: any) => {
    const sessions = (customer.sessions || []).map((s: any) => ({
      ...s,
      deposit_paid: paidSet.has(s.id),
    }));
    
    // Check for active sessions (not cancelled and not draft without deposit)
    const hasActiveSessions = sessions.some(
      (s: any) => s.status !== 'cancelled' && !(s.status === 'draft' && !s.deposit_paid)
    );

    return {
      ...customer,
      sessions,
      links: linksMap.get(customer.id) || [],
      has_active_sessions: hasActiveSessions,
    };
  });

  return NextResponse.json(enriched);
}
