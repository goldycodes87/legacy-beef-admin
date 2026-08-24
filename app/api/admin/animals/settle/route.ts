export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { settlePastButcherDates } from '@/lib/settle-butcher-dates';

export async function POST() {
  try {
    const { archived, needsAttention } = await settlePastButcherDates();
    return NextResponse.json({ archived, needs_attention: needsAttention });
  } catch (err) {
    console.error('Settle butcher dates error:', err);
    return NextResponse.json(
      { error: 'Could not check past butcher dates', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
