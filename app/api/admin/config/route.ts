export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('config')
      .select('key, value')
      .like('key', 'price_%');
    if (error) throw error;
    const config: Record<string, string> = {};
    data.forEach((row) => { config[row.key] = row.value; });
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const updates = Object.entries(body).map(([key, value]) => ({ key, value: String(value) }));
    const { error } = await supabase
      .from('config')
      .upsert(updates, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
