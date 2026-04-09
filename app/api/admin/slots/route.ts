export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';


export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const animalId = searchParams.get('animal_id');

    let query = supabase
      .from('sessions')
      .select(`
        id,
        purchase_type,
        status,
        cut_sheet_complete,
        created_at,
        admin_notes,
        hanging_weight_lbs,
        balance_paid,
        balance_due,
        customers (name, email, phone),
        animals (id, name, butcher_date, price_per_lb)
      `)
      .neq('status', 'cancelled').neq('status', 'draft')
      .order('created_at', { ascending: false });

    if (animalId) {
      query = query.eq('animal_id', animalId);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;

    // Get all paid deposits for these sessions
    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: paidDeposits } = await supabase
      .from('payments')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('type', 'deposit')
      .eq('status', 'paid');

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
        price_per_lb: session.animals?.price_per_lb || null,
        deposit_amount_cents: paidSessionIds.has(session.id) ? (session.purchase_type === "whole" ? 85000 : session.purchase_type === "half" ? 50000 : 25000) : 0,
        admin_notes: session.admin_notes || null,
        hanging_weight_lbs: session.hanging_weight_lbs || null,
        balance_paid: session.balance_paid || false,
        balance_due: session.balance_due || 0,
        balance_payment_method: session.balance_payment_method || null,
      });
      return acc;
    }, {});

    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch slots', detail: JSON.stringify(err) }, { status: 500 });
  }
}
