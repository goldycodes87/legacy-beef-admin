export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .select(`*, sessions(customers(name, email))`)
    .order('sent_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { target, subject, message, channel } = body;
  // target: 'all' | 'butcher_date:YYYY-MM-DD' | 'session:uuid' | 'pending_cut_sheets'

  let sessions: { id: string; customers: { email: string; name: string } | null }[] = [];

  if (target === 'all') {
    const { data } = await supabase
      .from('sessions')
      .select('id, customers(email, name)')
      .eq('deposit_paid', true)
      .neq('status', 'cancelled');
    sessions = (data || []) as unknown as typeof sessions;
  } else if (target === 'pending_cut_sheets') {
    const { data } = await supabase
      .from('sessions')
      .select('id, customers(email, name)')
      .eq('deposit_paid', true)
      .eq('cut_sheet_complete', false);
    sessions = (data || []) as unknown as typeof sessions;
  } else if (target.startsWith('butcher_date:')) {
    const date = target.replace('butcher_date:', '');
    const { data } = await supabase
      .from('sessions')
      .select('id, customers(email, name), animals!inner(butcher_date)')
      .eq('animals.butcher_date', date)
      .eq('deposit_paid', true);
    sessions = (data || []) as unknown as typeof sessions;
  } else if (target.startsWith('session:')) {
    const sessionId = target.replace('session:', '');
    const { data } = await supabase
      .from('sessions')
      .select('id, customers(email, name)')
      .eq('id', sessionId)
      .single();
    if (data) sessions = [data] as unknown as typeof sessions;
  }

  // Log notifications (actual sending via Resend goes in Block 15)
  const notifRecords = sessions.map(s => ({
    session_id: s.id,
    type: 'admin_manual',
    channel: channel || 'email',
    status: 'queued',
    sent_at: new Date().toISOString(),
  }));

  if (notifRecords.length > 0) {
    await supabase.from('notifications').insert(notifRecords);
  }

  return NextResponse.json({ success: true, sent_to: sessions.length });
}
