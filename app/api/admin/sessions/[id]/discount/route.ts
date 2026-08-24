export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeBalance } from '@/lib/money';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const { discount_amount, discount_note } = await request.json();

    const discount = Number(discount_amount);
    if (!Number.isFinite(discount) || discount < 0) {
      return NextResponse.json(
        { error: 'Discount must be a dollar amount of 0 or more.' },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from('sessions')
      .select(`
        hanging_weight_lbs, price_per_lb, balance_paid,
        animals (price_per_lb),
        payments (amount_cents, surcharge_cents, type, status)
      `)
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const animal = Array.isArray((session as any).animals)
      ? (session as any).animals[0]
      : (session as any).animals;

    // Recompute from source rather than adjusting the stored balance. Adding
    // and subtracting successive discounts drifts as soon as anything else
    // touches balance_due.
    const { totalCost, balanceDue } = computeBalance({
      hangingWeightLbs: (session as any).hanging_weight_lbs,
      pricePerLb: (session as any).price_per_lb ?? animal?.price_per_lb,
      payments: (session as any).payments,
      discountAmount: discount,
    });

    if (totalCost > 0 && discount > totalCost) {
      return NextResponse.json(
        { error: `Discount cannot exceed the order total of $${totalCost.toFixed(2)}.` },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      discount_amount: discount,
      discount_note: discount_note || null,
    };
    // Only touch the balance once there is a weight to price against, and
    // never reopen a balance the customer already settled.
    if (totalCost > 0 && !(session as any).balance_paid) {
      update.balance_due = balanceDue;
    }

    const { error } = await supabase.from('sessions').update(update).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, balance_due: balanceDue });
  } catch (err) {
    console.error('Discount error:', err);
    return NextResponse.json(
      { error: 'Failed to apply discount', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
