export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';


export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('animals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch animals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { butcher_date, estimated_ready_date, grass_fed_count, grain_finished_count, wagyu_count } = body;

    if (!butcher_date) return NextResponse.json({ error: 'Butcher date required' }, { status: 400 });

    const total = (grass_fed_count || 0) + (grain_finished_count || 0) + (wagyu_count || 0);
    if (total === 0) return NextResponse.json({ error: 'At least 1 head required' }, { status: 400 });

    // Format date for display: "May 2026"
    const dateLabel = new Date(butcher_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const inserts: Record<string, unknown>[] = [];

    if (grass_fed_count > 0) {
      inserts.push({
        name: `${dateLabel} — Grass-Fed`,
        animal_type: 'grass_fed',
        type: 'whole',
        total_animals: grass_fed_count,
        units_used: 0,
        butcher_date,
        estimated_ready_date: estimated_ready_date || null,
        price_per_lb: 8.00,
        status: 'available',
        wagyu_active: false,
      });
    }

    if (grain_finished_count > 0) {
      inserts.push({
        name: `${dateLabel} — Grain-Finished`,
        animal_type: 'grain_finished',
        type: 'whole',
        total_animals: grain_finished_count,
        units_used: 0,
        butcher_date,
        estimated_ready_date: estimated_ready_date || null,
        price_per_lb: 8.00,
        status: 'available',
        wagyu_active: false,
      });
    }

    if (wagyu_count > 0) {
      inserts.push({
        name: `${dateLabel} — American Wagyu`,
        animal_type: 'wagyu',
        type: 'whole',
        total_animals: wagyu_count,
        units_used: 0,
        butcher_date,
        estimated_ready_date: estimated_ready_date || null,
        price_per_lb: 9.50,
        status: 'available',
        wagyu_active: true,
      });
    }

    const { data, error } = await supabase
      .from('animals')
      .insert(inserts)
      .select();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/animals error:', err);
    return NextResponse.json({ error: 'Failed to create animals' }, { status: 500 });
  }
}
