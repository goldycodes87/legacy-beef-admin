import { computeBalance, type PaymentRow } from '@/lib/money';

/**
 * One answer to "where does this reservation actually stand".
 *
 * Every tab used to work this out for itself: Reservations decided a customer
 * had paid by looking for a deposit row, Payments by looking at money banked,
 * Cut Sheets by reading a deposit_amount column that is usually empty, and the
 * dashboard by summing payments including the card surcharge. So a customer
 * who settled in full without ever paying a separate deposit showed as paid on
 * one screen and "awaiting deposit" on another.
 *
 * Everything server-side should go through this.
 */

export interface SessionForSummary {
  status?: string | null;
  hanging_weight_lbs?: number | string | null;
  price_per_lb?: number | string | null;
  discount_amount?: number | string | null;
  balance_paid?: boolean | null;
  animals?: { price_per_lb?: number | string | null } | { price_per_lb?: number | string | null }[] | null;
  payments?: (PaymentRow & {
    paid_at?: string | null;
    method?: string | null;
    check_number?: string | null;
  })[] | null;
}

export interface ReservationSummary {
  /** Hanging weight x price, less any discount. Zero until a weight is entered. */
  orderTotalCents: number;
  /** Money that went toward the beef, excluding the card processing surcharge. */
  bankedCents: number;
  /** Surcharge collected for the processor — never counted as revenue. */
  surchargeCents: number;
  /** What the customer still owes. Zero when no weight has been entered yet. */
  outstandingCents: number;

  /** The real deposit, if one was taken. Zero-dollar rows are ignored. */
  depositCents: number | null;
  depositMethod: string | null;
  depositPaidAt: string | null;
  checkNumber: string | null;

  /** True once any real money has been received, however it was recorded. */
  hasPayment: boolean;
  /** True when a weight is known and nothing is outstanding. */
  fullyPaid: boolean;
  /** Marked settled but with no payment on file — under-reports revenue. */
  unrecordedSettlement: boolean;
}

function firstAnimal(session: SessionForSummary) {
  const a = session.animals;
  return Array.isArray(a) ? a[0] : a;
}

export function summarizeReservation(session: SessionForSummary): ReservationSummary {
  const animal = firstAnimal(session);

  // Zero-dollar rows are artifacts of the old auto-settle job, not payments.
  const paid = (session.payments || []).filter(
    (p) => p.status === 'paid' && (p.amount_cents || 0) > 0
  );

  const grossCents = paid.reduce((s, p) => s + (p.amount_cents || 0), 0);
  const surchargeCents = paid.reduce((s, p) => s + (p.surcharge_cents || 0), 0);
  const bankedCents = Math.max(0, grossCents - surchargeCents);

  const deposit = paid.find((p) => p.type === 'deposit') || null;
  const balancePayments = paid.filter((p) => p.type === 'balance');

  const { totalCost } = computeBalance({
    hangingWeightLbs: session.hanging_weight_lbs,
    pricePerLb: session.price_per_lb ?? animal?.price_per_lb,
    payments: [],
    discountAmount: 0,
  });
  const discountCents = Math.max(0, Math.round((Number(session.discount_amount) || 0) * 100));
  const orderTotalCents = Math.max(0, Math.round(totalCost * 100) - discountCents);

  const outstandingCents = orderTotalCents > 0 ? Math.max(0, orderTotalCents - bankedCents) : 0;

  return {
    orderTotalCents,
    bankedCents,
    surchargeCents,
    outstandingCents,

    depositCents: deposit?.amount_cents ?? null,
    depositMethod: deposit?.method ?? null,
    depositPaidAt: deposit?.paid_at ?? null,
    checkNumber: deposit?.check_number ?? null,

    hasPayment: bankedCents > 0,
    fullyPaid: orderTotalCents > 0 && outstandingCents === 0,
    unrecordedSettlement:
      !!session.balance_paid && balancePayments.length === 0 && orderTotalCents > bankedCents,
  };
}
