'use client';

import { Chip } from '@/components/ui/Chip';
import { formatCurrency, formatWeight, purchaseTypeShort } from '@/lib/format';
import { getStageMeta, getStageDetail, type StageInput } from '@/lib/reservation-status';

export interface ReservationCardData extends StageInput {
  id: string;
  customer_name: string;
  purchase_type: string;
  hanging_weight_lbs?: number | null;
  balance_due?: number | null;
  check_number?: string | null;
}

/**
 * One reservation, readable at arm's length on a phone.
 *
 * The desktop table has eight columns; this shows only what decides whether
 * Grant needs to act — who, what, what stage, and the one number that matters
 * at that stage.
 */
export function ReservationCard({
  reservation,
  animalLabel,
  onOpen,
}: {
  reservation: ReservationCardData;
  animalLabel?: string;
  onOpen: (r: ReservationCardData) => void;
}) {
  const meta = getStageMeta(reservation);
  const detail = getStageDetail(reservation);

  // The number worth showing depends on where the order is.
  const figure =
    meta.stage === 'balance_due'
      ? formatCurrency(reservation.balance_due)
      : reservation.hanging_weight_lbs
        ? formatWeight(reservation.hanging_weight_lbs)
        : null;

  const accent =
    meta.tone === 'danger' ? 'var(--danger-fg)'
    : meta.tone === 'warning' ? 'var(--warning-fg)'
    : meta.tone === 'gold' ? 'var(--gold-fg)'
    : meta.tone === 'success' ? 'var(--success-fg)'
    : 'var(--border-strong)';

  return (
    <button
      type="button"
      onClick={() => onOpen(reservation)}
      className="relative w-full text-left rounded-xl p-4 pl-5 overflow-hidden transition-colors"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: accent }}
      />

      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-semibold text-[15px] text-white truncate">
            {reservation.customer_name}
          </span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {purchaseTypeShort(reservation.purchase_type)}
            {animalLabel ? ` · ${animalLabel}` : ''}
          </span>
        </span>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </span>

      <span className="flex items-end justify-between gap-3 mt-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {detail}
        </span>
        {figure && (
          <span
            className="text-sm font-semibold tabular-nums shrink-0"
            style={{ color: 'var(--text)' }}
          >
            {figure}
          </span>
        )}
      </span>
    </button>
  );
}
