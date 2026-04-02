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
        deposit_paid,
        cut_sheet_complete,
        created_at,
        customers (name, email, phone),
        animals (id, name, butcher_date)
      `)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    if (animalId) {
      query = query.eq('animal_id', animalId);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;

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
        deposit_paid: session.deposit_paid,
        cut_sheet_complete: session.cut_sheet_complete,
        created_at: session.created_at,
      });
      return acc;
    }, {});

    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}
