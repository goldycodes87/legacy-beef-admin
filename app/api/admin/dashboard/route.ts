export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';


export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    // Total available animals (sum of total_animals column, not row count)
    const { data: animalCounts } = await supabase
      .from('animals')
      .select('total_animals')
      .eq('status', 'available');
    const totalAnimals = (animalCounts || []).reduce(
      (sum, a) => sum + (a.total_animals || 0), 0
    );

    // Open capacity (sum of remaining units across all available animals)
    const { data: animals } = await supabase
      .from('animals')
      .select('total_animals, units_used')
      .eq('status', 'available');

    const openCapacity = (animals || []).reduce(
      (sum, animal) => sum + ((animal.total_animals || 1) - (animal.units_used || 0)),
      0
    );

    // Reservations this season (deposit_paid = true)
    const { count: reservations } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('deposit_paid', true);

    // Revenue collected (sum of payments where status=paid)
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'paid');

    const revenue = (payments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

    // Pending cut sheets (deposit_paid=true AND cut_sheet_complete=false)
    const { count: pendingCutSheets } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('deposit_paid', true)
      .eq('cut_sheet_complete', false);

    // Cut sheets locked (status=locked)
    const { count: sheetsLocked } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'locked');

    // Awaiting hanging weight (status=locked)
    const { count: awaitingHangingWeight } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'locked');

    // Beef ready (status=beef_ready)
    const { count: beefReady } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'beef_ready');

    return NextResponse.json({
      total_animals: totalAnimals,
      open_capacity: openCapacity,
      reservations_this_season: reservations || 0,
      revenue_collected: revenue,
      pending_cut_sheets: pendingCutSheets || 0,
      cut_sheets_locked: sheetsLocked || 0,
      awaiting_hanging_weight: awaitingHangingWeight || 0,
      beef_ready: beefReady || 0,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
