export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get all animals with costs
  const { data: animals } = await supabase
    .from('animals')
    .select(`
      id, name, butcher_date, animal_type, home_raised,
      animal_costs (id, type, description, amount, date)
    `)
    .order('butcher_date', { ascending: false });

  // Get all sessions with payments for revenue
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, animal_id, purchase_type, is_splitting, group_size,
      hanging_weight_lbs, price_per_lb, balance_due, status,
      customers (id, name, email),
      payments (amount_cents, type, status, method)
    `)
    .not('status', 'in', '(cancelled,draft)');

  return NextResponse.json({ animals: animals || [], sessions: sessions || [] });
}
