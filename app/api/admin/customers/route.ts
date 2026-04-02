export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id, name, email, phone, address, city, state, zip, created_at,
      sessions(id, purchase_type, status, deposit_paid, created_at,
        animals(name, butcher_date, animal_type))
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
