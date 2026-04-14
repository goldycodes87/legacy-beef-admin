export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { customer_id_a, customer_id_b, relationship } = await request.json();

  if (!customer_id_a || !customer_id_b || !relationship) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  if (customer_id_a === customer_id_b) {
    return NextResponse.json(
      { error: 'Cannot link customer to itself' },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase
      .from('customer_links')
      .insert([
        {
          customer_id_a,
          customer_id_b,
          relationship,
        },
      ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to link customers' },
      { status: 500 }
    );
  }
}
