export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Only these keys may be read or written through the admin settings screen. */
function isEditableKey(key: string): boolean {
  return (
    key.startsWith('price_') ||
    key.startsWith('deposit_') ||
    key === 'card_surcharge_pct'
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('config').select('key, value');
    if (error) throw error;
    const config: Record<string, string> = {};
    (data || []).forEach((row) => {
      if (isEditableKey(row.key)) config[row.key] = row.value;
    });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const updates: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!isEditableKey(key)) {
        return NextResponse.json(
          { error: `Not an editable setting: ${key}` },
          { status: 400 }
        );
      }
      const num = parseFloat(String(value));
      if (Number.isNaN(num) || num < 0) {
        return NextResponse.json(
          { error: `"${key}" must be a number of 0 or more.` },
          { status: 400 }
        );
      }
      updates.push({ key, value: String(num) });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
    }

    const { error } = await supabase
      .from('config')
      .upsert(updates, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to save config', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
