/**
 * Single source of truth for prices, deposits, and the card surcharge.
 *
 * Mirrors legacy-beef-portal/src/lib/config.ts — both apps read the same
 * `config` table. Keep the two files in sync until they are extracted into a
 * shared package. Never hardcode a price or deposit anywhere else.
 */

export type AnimalType = 'grass_fed' | 'grain_finished' | 'wagyu' | string;
export type PurchaseType = 'whole' | 'half' | 'quarter' | string;

const PRICE_FALLBACKS: Record<string, number> = {
  price_whole_grass_fed: 8.0,
  price_half_grass_fed: 8.25,
  price_quarter_grass_fed: 8.5,
  price_whole_grain_finished: 8.0,
  price_half_grain_finished: 8.25,
  price_quarter_grain_finished: 8.5,
  price_whole_wagyu: 9.5,
  price_half_wagyu: 9.75,
  price_quarter_wagyu: 10.0,
};

const DEPOSIT_FALLBACKS: Record<string, number> = {
  deposit_whole_single: 850,
  deposit_whole_split: 500,
  deposit_half: 500,
  deposit_half_split: 250,
  deposit_quarter: 250,
  deposit_quarter_split: 250,
};

const DEFAULT_CARD_SURCHARGE_PCT = 3;

export async function getConfig(): Promise<Record<string, number>> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('config').select('key, value');

  const result: Record<string, number> = {};
  (data || []).forEach((row: { key: string; value: string }) => {
    const parsed = parseFloat(row.value);
    if (!Number.isNaN(parsed)) result[row.key] = parsed;
  });
  return result;
}

function normalizeAnimalType(animalType?: AnimalType): string {
  if (animalType === 'wagyu') return 'wagyu';
  if (animalType === 'grain_finished') return 'grain_finished';
  return 'grass_fed';
}

export function getPricePerLb(
  config: Record<string, number>,
  purchaseType: PurchaseType,
  animalType?: AnimalType
): number {
  const key = `price_${purchaseType}_${normalizeAnimalType(animalType)}`;
  return (
    config[key] ??
    config[`price_${purchaseType}`] ??
    PRICE_FALLBACKS[key] ??
    PRICE_FALLBACKS.price_half_grass_fed
  );
}

function baseDepositKey(purchaseType: PurchaseType, isSplitting: boolean): string {
  if (purchaseType === 'whole') return isSplitting ? 'deposit_whole_split' : 'deposit_whole_single';
  if (purchaseType === 'half') return isSplitting ? 'deposit_half_split' : 'deposit_half';
  return isSplitting ? 'deposit_quarter_split' : 'deposit_quarter';
}

export function getDepositAmount(
  config: Record<string, number>,
  purchaseType: PurchaseType,
  isSplitting: boolean,
  animalType?: AnimalType
): number {
  const base = baseDepositKey(purchaseType, isSplitting);
  const typed = `${base}_${normalizeAnimalType(animalType)}`;
  return config[typed] ?? config[base] ?? DEPOSIT_FALLBACKS[base] ?? 250;
}

/** Card surcharge as a percentage, e.g. 3 means 3%. */
export function getCardSurchargePct(config: Record<string, number>): number {
  const pct = config['card_surcharge_pct'];
  return typeof pct === 'number' && pct >= 0 ? pct : DEFAULT_CARD_SURCHARGE_PCT;
}

/** Surcharge in cents for a base amount, using the configured percentage. */
export function getSurchargeCents(
  amountCents: number,
  config: Record<string, number>
): number {
  return Math.round((amountCents * getCardSurchargePct(config)) / 100);
}
