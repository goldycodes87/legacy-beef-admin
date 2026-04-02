export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, purchase_type, status, cut_sheet_complete, cut_sheet_locked_at,
      hanging_weight_lbs, balance_due, balance_paid, deposit_amount,
      customers(id, name, email, phone),
      animals(id, name, butcher_date, estimated_ready_date, animal_type, price_per_lb),
      cut_sheet_answers(section, answers, completed, locked, custom_request, custom_request_status)
    `)
    .not('status', 'eq', 'draft')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
