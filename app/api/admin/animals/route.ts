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
    const { animal_type, total_animals, butcher_date, estimated_ready_date, grass_fed_count, grain_finished_count, wagyu_count } = body;

    // Handle two modes:
    // 1. Single animal creation (from dynamic edit): animal_type, total_animals, butcher_date, estimated_ready_date
    // 2. Bulk creation (from add butcher date): grass_fed_count, grain_finished_count, wagyu_count, butcher_date, estimated_ready_date

    // Mode 1: Single animal (used by dynamic edit modal)
    if (animal_type && total_animals !== undefined) {
      if (!butcher_date) return NextResponse.json({ error: 'Butcher date required' }, { status: 400 });
      if (total_animals <= 0) return NextResponse.json({ error: 'Animal count must be > 0' }, { status: 400 });

      // Fetch current prices from config
      const { data: configData } = await supabase
        .from('config')
        .select('key, value')
        .like('key', 'price_whole_%');

      const configMap: Record<string, number> = {};
      configData?.forEach(row => { configMap[row.key] = parseFloat(row.value); });

      const priceMap: Record<string, number> = {
        grass_fed: configMap['price_whole_grass_fed'] ?? 8.00,
        grain_finished: configMap['price_whole_grain_finished'] ?? 8.00,
        wagyu: configMap['price_whole_wagyu'] ?? 9.50,
      };

      const typeLabel = animal_type === 'grass_fed' ? 'Grass-Fed' : animal_type === 'grain_finished' ? 'Grain-Finished' : 'American Wagyu';
      const dateLabel = new Date(butcher_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const { data, error } = await supabase
        .from('animals')
        .insert([
          {
            name: `${dateLabel} — ${typeLabel}`,
            animal_type,
            type: 'whole',
            total_animals,
            units_used: 0,
            butcher_date,
            estimated_ready_date: estimated_ready_date || null,
            price_per_lb: priceMap[animal_type] || 8.00,
            status: 'available',
            wagyu_active: animal_type === 'wagyu',
          }
        ])
        .select();

      if (error) throw error;
      return NextResponse.json(data[0], { status: 201 });
    }

    // Mode 2: Bulk creation (original format from add butcher date form)
    if (!butcher_date) return NextResponse.json({ error: 'Butcher date required' }, { status: 400 });

    const total = (grass_fed_count || 0) + (grain_finished_count || 0) + (wagyu_count || 0);
    if (total === 0) return NextResponse.json({ error: 'At least 1 head required' }, { status: 400 });

    // Format date for display: "May 2026"
    const dateLabel = new Date(butcher_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Fetch current prices from config
    const { data: configData } = await supabase
      .from('config')
      .select('key, value')
      .like('key', 'price_whole_%');

    const configMap: Record<string, number> = {};
    configData?.forEach(row => { configMap[row.key] = parseFloat(row.value); });

    const grassPrice = configMap['price_whole_grass_fed'] ?? 8.00;
    const grainPrice = configMap['price_whole_grain_finished'] ?? 8.00;
    const wagyuPrice = configMap['price_whole_wagyu'] ?? 9.50;

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
        price_per_lb: grassPrice,
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
        price_per_lb: grainPrice,
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
        price_per_lb: wagyuPrice,
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
