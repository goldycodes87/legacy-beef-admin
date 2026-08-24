/**
 * One way to write a date, a dollar amount, and an order label.
 *
 * These were previously re-implemented per page — dates were formatted about
 * eighteen different ways and money three, which is why the panel reads as
 * unfinished even where the data is right.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Postgres `date` columns are day-accurate; parsing them as UTC shifts them. */
function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Jun 5, 2026" — the default for tables and cards. */
export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "June 5, 2026" — for headings and customer-facing copy. */
export function formatDateLong(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "Jun 2026" — for grouping by butcher date. */
export function formatMonth(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** "Jun 5, 2026, 2:14 PM" — for audit trails. */
export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** "$1,284.50" from dollars. */
export function formatCurrency(dollars: number | string | null | undefined, fallback = '—'): string {
  const n = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (n === null || n === undefined || Number.isNaN(n)) return fallback;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** "$1,284.50" from integer cents. */
export function formatCents(cents: number | null | undefined, fallback = '—'): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return fallback;
  return formatCurrency(cents / 100, fallback);
}

/** "394.5 lbs" */
export function formatWeight(lbs: number | string | null | undefined, fallback = '—'): string {
  const n = typeof lbs === 'string' ? parseFloat(lbs) : lbs;
  if (n === null || n === undefined || Number.isNaN(n)) return fallback;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} lbs`;
}

export function purchaseTypeLabel(type: string | null | undefined): string {
  if (type === 'whole') return 'Whole Beef';
  if (type === 'half') return 'Half Beef';
  if (type === 'quarter') return 'Quarter Beef';
  return type || '—';
}

/** Short form for cards, where space is tight. */
export function purchaseTypeShort(type: string | null | undefined): string {
  if (type === 'whole') return 'Whole';
  if (type === 'half') return 'Half';
  if (type === 'quarter') return 'Quarter';
  return type || '—';
}

export function animalTypeLabel(type: string | null | undefined): string {
  if (type === 'grass_fed') return 'Grass-Fed';
  if (type === 'grain_finished') return 'Grain-Finished';
  if (type === 'wagyu') return 'Wagyu';
  return type || '—';
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === 'card') return 'Card';
  if (method === 'cash') return 'Cash';
  if (method === 'check') return 'Check';
  if (method === 'echeck') return 'eCheck';
  return method || '—';
}
