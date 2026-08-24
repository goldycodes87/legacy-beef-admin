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

/**
 * Permanently removes a customer who has no financial history.
 *
 * Anyone who has ever paid is refused: deleting them would destroy the
 * payments rows that evidence money changing hands, along with their signed
 * cut sheets. Archive those customers instead — it hides them from the list
 * and keeps the record.
 */
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
      { error: 'This customer has active reservations. Cancel them first, or archive the customer instead.' },
      { status: 400 }
    );
  }

  // Refuse if any money was ever recorded against this customer.
  const { data: everySession } = await supabase
    .from('sessions')
    .select('id')
    .eq('customer_id', id);
  const everySessionId = (everySession || []).map((s: { id: string }) => s.id);

  if (everySessionId.length > 0) {
    const { data: paymentRows } = await supabase
      .from('payments')
      .select('id')
      .in('session_id', everySessionId)
      .limit(1);

    if (paymentRows && paymentRows.length > 0) {
      return NextResponse.json(
        {
          error:
            'This customer has payment history, which must be kept. Archive them instead — they will be hidden from the list but the record stays.',
        },
        { status: 409 }
      );
    }
  }

  // Delete customer_links (FK direct to customers)
  await supabase.from('customer_links')
    .delete()
    .or(`customer_id_a.eq.${id},customer_id_b.eq.${id}`);

  // Delete butcher_slots (FK direct to customers)
  await supabase.from('butcher_slots').delete().eq('customer_id', id);

  // Nullify self-referencing session FKs first
  const { data: allSessionsFirst } = await supabase
    .from('sessions').select('id').eq('customer_id', id);
  const sessionIdsFirst = (allSessionsFirst || []).map((s: any) => s.id);
  if (sessionIdsFirst.length > 0) {
    await supabase.from('sessions').update({ partner_session_id: null, cut_sheet_partner_session_id: null }).in('id', sessionIdsFirst);
    await supabase.from('notifications').delete().in('session_id', sessionIdsFirst);
    await supabase.from('coupon_codes').delete().in('redeemed_by', sessionIdsFirst);
  }

  // Get all session IDs first
  const { data: allSessions } = await supabase
    .from('sessions').select('id').eq('customer_id', id);
  const sessionIds = (allSessions || []).map((s: any) => s.id);
  if (sessionIds.length > 0) {
    await supabase.from('payments').delete().in('session_id', sessionIds);
    await supabase.from('cut_sheet_answers').delete().in('session_id', sessionIds);
    await supabase.from('pickup_appointments').delete().in('session_id', sessionIds);
    await supabase.from('sessions').delete().eq('customer_id', id);
  }

  const { error } = await supabase.from('customers').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
