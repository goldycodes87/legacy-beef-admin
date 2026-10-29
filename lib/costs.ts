export const COST_TYPES = ['purchase', 'feed', 'butcher', 'other'] as const;

/**
 * The editable fields of an animal cost, checked. `partial` allows an update
 * that changes only some of them. Nothing outside these fields gets through.
 */
export function parseCost(
  body: Record<string, unknown>,
  partial = false
): { error: string } | { row: Record<string, unknown> } {
  const row: Record<string, unknown> = {};
  if (body.type !== undefined || !partial) {
    if (!COST_TYPES.includes(body.type as (typeof COST_TYPES)[number])) {
      return { error: `Type must be one of: ${COST_TYPES.join(', ')}.` };
    }
    row.type = body.type;
  }
  if (body.amount !== undefined || !partial) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be more than $0.' };
    row.amount = Math.round(amount * 100) / 100;
  }
  if (body.description !== undefined) row.description = body.description || null;
  if (body.date !== undefined) row.date = body.date || null;
  return { row };
}
