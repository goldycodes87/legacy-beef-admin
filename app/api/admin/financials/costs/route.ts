export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseCost } from '@/lib/costs';

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  if (!body.animal_id) return NextResponse.json({ error: 'Missing animal.' }, { status: 400 });

  const parsed = parseCost(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from('animal_costs')
    .insert({ animal_id: body.animal_id, ...parsed.row })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
