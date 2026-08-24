/**
 * One balance calculation for the whole business.
 *
 * Mirrors legacy-beef-portal/src/lib/money.ts. Keep the two in sync until they
 * are extracted into a shared package.
 *
 * Two rules this encodes, both of which were previously wrong somewhere:
 *
 * 1. The card processing surcharge is a fee, not money toward beef. A card
 *    deposit is stored with the surcharge included in amount_cents, so
 *    crediting the full amount against the balance under-charged every card
 *    customer by the surcharge.
 * 2. Discounts are part of the balance. Recomputing a balance without the
 *    discount term silently re-bills a customer you gave a discount to.
 *
 * All arithmetic runs in integer cents; only the returned values are dollars.
 */

export interface PaymentRow {
  type?: string | null;
  status?: string | null;
  amount_cents?: number | null;
  surcharge_cents?: number | null;
}

export interface BalanceInput {
  hangingWeightLbs?: number | string | null;
  pricePerLb?: number | string | null;
  payments?: PaymentRow[] | null;
  discountAmount?: number | string | null;
}

export interface BalanceBreakdown {
  /** Hanging weight x price per lb. */
  totalCost: number;
  /** Deposit money applied to the beef, excluding processing surcharge. */
  depositCredit: number;
  /** Discount applied by the admin. */
  discount: number;
  /** What the customer still owes, never below zero. */
  balanceDue: number;
}

function toCents(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return n;
}

/**
 * Cents a payment actually put toward the beef: the amount charged minus the
 * card processing surcharge bundled into it.
 */
export function creditedCents(payment: PaymentRow): number {
  const amount = toNumber(payment.amount_cents);
  const surcharge = toNumber(payment.surcharge_cents);
  return Math.max(0, Math.round(amount - surcharge));
}

/** Total paid-deposit money credited toward the beef, in cents. */
export function depositCreditCents(payments: PaymentRow[] | null | undefined): number {
  return (payments || [])
    .filter((p) => p.type === 'deposit' && p.status === 'paid')
    .reduce((sum, p) => sum + creditedCents(p), 0);
}

export function computeBalance(input: BalanceInput): BalanceBreakdown {
  const totalCents = Math.round(
    toNumber(input.hangingWeightLbs) * toNumber(input.pricePerLb) * 100
  );
  const depositCents = depositCreditCents(input.payments);
  const discountCents = Math.max(0, toCents(input.discountAmount));
  const balanceCents = Math.max(0, totalCents - depositCents - discountCents);

  return {
    totalCost: totalCents / 100,
    depositCredit: depositCents / 100,
    discount: discountCents / 100,
    balanceDue: balanceCents / 100,
  };
}
