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

    const { data, error } = await supabase
      .from('animals')
      .insert([{
        name: body.name,
        animal_type: body.animal_type,
        total_animals: body.total_animals,
        units_used: 0,
        butcher_date: body.butcher_date,
        estimated_ready_date: body.estimated_ready_date,
        price_per_lb: body.price_per_lb,
        status: body.status || 'available',
        wagyu_active: body.wagyu_active || false,
      }])
      .select();

    if (error) throw error;

    return NextResponse.json(data[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create animal' }, { status: 500 });
  }
}
