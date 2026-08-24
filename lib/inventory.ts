/**
 * How much of one animal a purchase consumes.
 *
 * Capacity is tracked in animals.units_used as a fraction of whole animals.
 * Adjust it only through the adjust_animal_units database function, which
 * locks the row — reading, adding in JavaScript, and writing back loses
 * updates when two people book at once.
 */
export function unitCostFor(purchaseType: string | null | undefined): number {
  if (purchaseType === 'whole') return 1.0;
  if (purchaseType === 'half') return 0.5;
  return 0.25;
}
