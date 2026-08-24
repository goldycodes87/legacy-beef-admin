import type { Tone } from '@/components/ui/Chip';

/**
 * What a reservation needs next.
 *
 * Driven by money actually outstanding, not by whether a deposit row exists. A
 * customer who never paid a separate deposit but settled the whole order at
 * pickup is paid up, and every screen should say so.
 */
export type ReservationStage =
  | 'cancelled'
  | 'picked_up'
  | 'awaiting_deposit'
  | 'needs_cut_sheet'
  | 'needs_weight'
  | 'balance_due'
  | 'ready_for_pickup'
  | 'in_progress';

export interface StageInput {
  status?: string | null;
  cut_sheet_complete?: boolean;
  /** Hanging weight x price less discount, in cents. Zero until weighed. */
  order_total_cents?: number;
  /** Money received toward the beef, net of card surcharge, in cents. */
  banked_cents?: number;
  /** Still owed, in cents. */
  outstanding_cents?: number;
  intended_payment_method?: string | null;
}

export interface StageMeta {
  stage: ReservationStage;
  label: string;
  tone: Tone;
  /** True when Grant has to do something before this order can move forward. */
  needsAction: boolean;
}

export function getStage(r: StageInput): ReservationStage {
  if (r.status === 'cancelled') return 'cancelled';
  if (r.status === 'picked_up') return 'picked_up';

  const orderTotal = r.order_total_cents ?? 0;
  const banked = r.banked_cents ?? 0;
  const outstanding = r.outstanding_cents ?? 0;

  // Once a weight is entered the order has a real price, so money decides.
  if (orderTotal > 0) {
    return outstanding > 0 ? 'balance_due' : 'ready_for_pickup';
  }

  // Before weighing: nothing received yet means we are waiting on the deposit.
  if (banked <= 0) return 'awaiting_deposit';
  if (!r.cut_sheet_complete) return 'needs_cut_sheet';
  return 'needs_weight';
}

const META: Record<ReservationStage, Omit<StageMeta, 'stage'>> = {
  cancelled:        { label: 'Cancelled',        tone: 'neutral', needsAction: false },
  picked_up:        { label: 'Picked up',        tone: 'neutral', needsAction: false },
  awaiting_deposit: { label: 'Awaiting deposit', tone: 'danger',  needsAction: true },
  needs_cut_sheet:  { label: 'Cut sheet open',   tone: 'info',    needsAction: false },
  needs_weight:     { label: 'Needs weight',     tone: 'warning', needsAction: true },
  balance_due:      { label: 'Balance due',      tone: 'gold',    needsAction: true },
  ready_for_pickup: { label: 'Ready for pickup', tone: 'success', needsAction: true },
  in_progress:      { label: 'In progress',      tone: 'info',    needsAction: false },
};

export function getStageMeta(r: StageInput): StageMeta {
  const stage = getStage(r);
  return { stage, ...META[stage] };
}

/** One line describing what is actually outstanding, for the card subtitle. */
export function getStageDetail(r: StageInput): string {
  switch (getStage(r)) {
    case 'awaiting_deposit':
      return r.intended_payment_method === 'check' || r.intended_payment_method === 'cash'
        ? `Paying by ${r.intended_payment_method} — not received`
        : 'No payment received yet';
    case 'needs_cut_sheet':
      return 'Waiting on the customer';
    case 'needs_weight':
      return 'Cut sheet done — enter hanging weight';
    case 'balance_due':
      return 'Balance outstanding';
    case 'ready_for_pickup':
      return 'Paid in full — ready to collect';
    case 'picked_up':
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}
