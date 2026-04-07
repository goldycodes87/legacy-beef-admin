export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data: windows } = await supabase
    .from('pickup_windows')
    .select('*')
    .order('pickup_date', { ascending: true })
    .order('start_time', { ascending: true });
  
  return NextResponse.json(windows || []);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { label, pickup_date, start_time, end_time, max_slots } = await request.json();
  
  const { data, error } = await supabase
    .from('pickup_windows')
    .insert({
      label,
      pickup_date,
      start_time,
      end_time,
      max_slots: max_slots || 999,
      active: true,
    })
    .select()
    .single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const windowId = new URL(request.url).searchParams.get('id');
  
  // Check if appointments exist
  const { count } = await supabase
    .from('pickup_appointments')
    .select('id', { count: 'exact' })
    .eq('window_id', windowId);
  
  if (count && count > 0) {
    return NextResponse.json({ error: 'Cannot delete window with appointments' }, { status: 400 });
  }
  
  const { error } = await supabase
    .from('pickup_windows')
    .delete()
    .eq('id', windowId);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
