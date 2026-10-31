export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // customers hangs off sessions (pickup_appointments has no customer FK),
  // and ordering by a window column needs the referenced table named — doing
  // the sort here keeps the query simple.
  const { data: appointments, error } = await supabase
    .from('pickup_appointments')
    .select(`
      id, session_id, pickup_window_id, is_alternate_pickup, pickup_person_name, pickup_person_phone,
      sessions(id, status, customer_id, purchase_type, customers(id, name, email)),
      pickup_windows(id, label, pickup_date, start_time, end_time)
    `);

  if (error) return NextResponse.json([], { status: 500 });

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  const rows = (appointments || [])
    .map((a) => {
      const session = one(a.sessions as unknown as { customers?: unknown }[] | { customers?: unknown });
      return {
        ...a,
        sessions: session,
        pickup_windows: one(a.pickup_windows),
        customers: one((session as { customers?: unknown } | null)?.customers as never) ?? { name: '—' },
      };
    })
    .filter((a) => a.pickup_windows)
    .sort((a, b) => {
      const aw = a.pickup_windows as { pickup_date: string; start_time: string };
      const bw = b.pickup_windows as { pickup_date: string; start_time: string };
      return (
        aw.pickup_date.localeCompare(bw.pickup_date) || aw.start_time.localeCompare(bw.start_time)
      );
    });

  return NextResponse.json(rows);
}
