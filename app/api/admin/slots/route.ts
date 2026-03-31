import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET() {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        purchase_type,
        status,
        deposit_paid,
        cut_sheet_complete,
        created_at,
        customers (name),
        animals (name, butcher_date)
      `)
      .order('created_at', { ascending: false });

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
