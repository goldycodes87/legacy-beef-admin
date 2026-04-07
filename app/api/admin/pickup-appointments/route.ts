export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  const { data: appointments } = await supabase
    .from('pickup_appointments')
    .select(`
      id, session_id, window_id, is_alternate_pickup, pickup_person_name, pickup_person_phone,
      sessions(id, status, customer_id, purchase_type),
      pickup_windows(id, label, pickup_date, start_time, end_time),
      customers(id, name, email)
    `)
    .order('pickup_date', { ascending: true })
    .order('start_time', { ascending: true });

  return NextResponse.json(appointments || []);
}
