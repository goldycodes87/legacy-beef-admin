export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getConfig, getDepositAmount } from '@/lib/config';


export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const config = await getConfig();
    const { searchParams } = new URL(request.url);
    const animalId = searchParams.get('animal_id');

    let query = supabase
      .from('sessions')
      .select(`
        id,
        purchase_type,
        is_splitting,
        status,
        cut_sheet_complete,
        created_at,
        admin_notes,
        hanging_weight_lbs,
        balance_paid,
        balance_due,
        balance_payment_method,
        price_per_lb,
        intended_payment_method,
        discount_amount,
        discount_note,
        deposit_amount,
        customers (name, email, phone),
        animals (id, name, animal_type, butcher_date, price_per_lb)
      `)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (animalId) {
      query = query.eq('animal_id', animalId);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;

    // Real paid deposits only. Zero-dollar rows are artifacts of the
    // auto-settle job, and counting them made unpaid orders look settled.
    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: paidDeposits } = await supabase
      .from('payments')
      .select('session_id, amount_cents, method, check_number')
      .in('session_id', sessionIds)
      .eq('type', 'deposit')
      .eq('status', 'paid')
      .gt('amount_cents', 0);

    const paidSessionIds = new Set((paidDeposits || []).map((p: any) => p.session_id));

    if (animalId) {
      // Return flat array for single animal lookup
      const flat = (sessions || []).map((s: any) => ({
        id: s.id,
        customer_name: s.customers?.name || 'Unknown',
        customer_email: s.customers?.email || '',
        customer_phone: s.customers?.phone || '',
        purchase_type: s.purchase_type,
        status: s.status,
        deposit_paid: paidSessionIds.has(s.id),
        cut_sheet_complete: s.cut_sheet_complete,
        created_at: s.created_at,
        admin_notes: s.admin_notes || null,
        hanging_weight_lbs: s.hanging_weight_lbs || null,
        payment_method: paidDeposits?.find((p: any) => p.session_id === s.id)?.method || null,
        check_number: paidDeposits?.find((p: any) => p.session_id === s.id)?.check_number || null,
        intended_payment_method: s.intended_payment_method || null,
        discount_amount: s.discount_amount || 0,
        discount_note: s.discount_note || null,
      }));
      return NextResponse.json(flat);
    }

    // Group by animal
    const grouped = (sessions || []).reduce((acc: any, session: any) => {
      const animalName = session.animals?.name || 'Unknown';
      if (!acc[animalName]) {
        acc[animalName] = {
          animal: session.animals,
          sessions: [],
        };
      }
      acc[animalName].sessions.push({
        id: session.id,
        customer_name: session.customers?.name || 'Unknown',
        purchase_type: session.purchase_type,
        status: session.status,
        deposit_paid: paidSessionIds.has(session.id),
        cut_sheet_complete: session.cut_sheet_complete,
        created_at: session.created_at,
        price_per_lb: session.price_per_lb || session.animals?.price_per_lb || null,
        deposit_amount_cents: Math.round(
          (session.deposit_amount ??
            getDepositAmount(
              config,
              session.purchase_type,
              session.is_splitting || false,
              session.animals?.animal_type
            )) * 100
        ),
        admin_notes: session.admin_notes || null,
        hanging_weight_lbs: session.hanging_weight_lbs || null,
        balance_paid: session.balance_paid || false,
        balance_due: session.balance_due || 0,
        balance_payment_method: session.balance_payment_method || null,
        payment_method: paidDeposits?.find((p: any) => p.session_id === session.id)?.method || null,
        check_number: paidDeposits?.find((p: any) => p.session_id === session.id)?.check_number || null,
        intended_payment_method: session.intended_payment_method || null,
        discount_amount: session.discount_amount || 0,
        discount_note: session.discount_note || null,
      });
      return acc;
    }, {});

    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch slots', detail: JSON.stringify(err) }, { status: 500 });
  }
}
