export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;
  const body = await request.json();

  const { error } = await supabase.from('customers')
    .update({
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  const { id } = await params;

  // Safety check — no active sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('customer_id', id)
    .not('status', 'in', '("cancelled","draft")');

  if (sessions && sessions.length > 0) {
    return NextResponse.json(
      { error: 'Customer has active sessions' },
      { status: 400 }
    );
  }

  // Delete cancelled/draft sessions first to satisfy FK constraint
  await supabase.from('sessions').delete().eq('customer_id', id);

  const { error } = await supabase.from('customers').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
