export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { source_id, target_id, merged_data } = await request.json();

  if (!source_id || !target_id) {
    return NextResponse.json(
      { error: 'Missing source_id or target_id' },
      { status: 400 }
    );
  }

  if (source_id === target_id) {
    return NextResponse.json(
      { error: 'Cannot merge customer with itself' },
      { status: 400 }
    );
  }

  try {
    // 1. Update all sessions from source to target
    await supabase
      .from('sessions')
      .update({ customer_id: target_id })
      .eq('customer_id', source_id);

    // 2. Apply merged field choices to target customer
    if (merged_data) {
      await supabase.from('customers')
        .update(merged_data)
        .eq('id', target_id);
    }

    // 3. Delete source customer
    await supabase.from('customers').delete().eq('id', source_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to merge customers' },
      { status: 500 }
    );
  }
}
