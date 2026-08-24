import type { Tone } from '@/components/ui/Chip';

/**
 * What a reservation needs next.
 *
 * The raw `status` column says where an order is in the pipeline, but not what
 * it is waiting on. This derives the latter so a card can say "needs weight"
 * rather than "locked", and so the list can be filtered down to the orders
 * that actually need attention.
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
  deposit_paid?: boolean;
  cut_sheet_complete?: boolean;
  hanging_weight_lbs?: number | null;
  balance_due?: number | null;
  balance_paid?: boolean;
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
  if (!r.deposit_paid) return 'awaiting_deposit';

  const hasWeight = typeof r.hanging_weight_lbs === 'number' && r.hanging_weight_lbs > 0;
  const owes = (r.balance_due ?? 0) > 0 && !r.balance_paid;

  if (hasWeight && owes) return 'balance_due';
  if (hasWeight) return 'ready_for_pickup';
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
export function getStageDetail(r: StageInput & { check_number?: string | null }): string {
  switch (getStage(r)) {
    case 'awaiting_deposit':
      return r.intended_payment_method === 'check' || r.intended_payment_method === 'cash'
        ? `Paying by ${r.intended_payment_method} — not received`
        : 'Deposit not paid';
    case 'needs_cut_sheet':
      return 'Waiting on the customer';
    case 'needs_weight':
      return 'Cut sheet done — enter hanging weight';
    case 'balance_due':
      return 'Balance outstanding';
    case 'ready_for_pickup':
      return 'Paid in full';
    case 'picked_up':
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}
