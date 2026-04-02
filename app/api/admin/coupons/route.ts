export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { code, type, value, expires_at, single_use } = body;

  if (!code || !type || value === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('coupon_codes')
    .insert({
      code: code.toUpperCase(),
      type,
      value,
      expires_at,
      single_use: single_use ?? true,
      redeemed: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { id } = await request.json();

  await supabase.from('coupon_codes').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
