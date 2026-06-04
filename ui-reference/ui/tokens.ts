/**
 * Shared token presets — single source of truth for repeated chip/status maps
 * that were previously duplicated across stage-list.tsx, dugout/page.tsx,
 * dugout-notes.tsx, etc.
 *
 * Each preset returns a `Tone` value that Chip / StatusChip can consume.
 */

export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "gold"
  | "purple";

export interface ChipPreset {
  label: string;
  tone: Tone;
  /** Optional glyph shown before the label (unicode char, keeps bundle small) */
  icon?: string;
}

/* ── Payment status (production_records, clubhouse_orders) ─────────────── */
export const PAYMENT_CHIP: Record<string, ChipPreset> = {
  paid:          { label: "PAID",     tone: "success", icon: "\u2713" },
  invoiced:      { label: "INVOICED", tone: "info",    icon: "\u2709" },
  needs_payment: { label: "UNPAID",   tone: "warning", icon: "$" },
};

/* ── Production stage (production_records.stage) ──────────────────────── */
export const STAGE_CHIP: Record<string, ChipPreset> = {
  on_deck:      { label: "ON DECK",      tone: "info" },
  turned:       { label: "TURNED",       tone: "success" },
  at_bench:     { label: "AT THE BENCH", tone: "purple" },
  on_bench:     { label: "AT THE BENCH", tone: "purple" },
  at_laser:     { label: "AT THE LASER", tone: "accent" },
  home_stretch:  { label: "HOME STRETCH",  tone: "warning" },
  locked_in:     { label: "HOME STRETCH",  tone: "warning" },
  ready_to_ship: { label: "READY TO SHIP", tone: "gold" },
  shipped:       { label: "SHIPPED",       tone: "neutral" },
  firewood:     { label: "FIREWOOD",     tone: "danger" },
  salvage:      { label: "SALVAGE",      tone: "neutral" },
  free_agent:   { label: "FREE AGENT",   tone: "info" },
  dismissed:    { label: "DISMISSED",    tone: "neutral" },
};

/* ── Shopify draft invoice status ──────────────────────────────────────── */
export const INVOICE_CHIP: Record<string, ChipPreset> = {
  paid:     { label: "PAID",          tone: "success" },
  sent:     { label: "INVOICE SENT",  tone: "warning" },
  not_sent: { label: "DRAFT",         tone: "neutral" },
};

/* ── Brand tag (Dugout notes) ──────────────────────────────────────────── */
export const BRAND_CHIP: Record<string, ChipPreset> = {
  bergbat:   { label: "BERG BAT",   tone: "danger" },   /* distinct from --accent so both render correctly on /splitgrip */
  splitgrip: { label: "SPLIT GRIP", tone: "info" },
};

/* ── berg_bat_orders.status ────────────────────────────────────────────── */
export const BERG_ORDER_STATUS_CHIP: Record<string, ChipPreset> = {
  in_progress: { label: "IN PRODUCTION", tone: "info" },
  completed:   { label: "COMPLETED",     tone: "success" },
  shipped:     { label: "SHIPPED",       tone: "neutral" },
  cancelled:   { label: "CANCELLED",     tone: "danger" },
};

/* ── clubhouse_orders.status ───────────────────────────────────────────── */
export const CLUBHOUSE_ORDER_STATUS_CHIP: Record<string, ChipPreset> = {
  submitted:   { label: "SUBMITTED",     tone: "warning" },
  in_progress: { label: "IN PRODUCTION", tone: "info" },
  completed:   { label: "COMPLETED",     tone: "success" },
  shipped:     { label: "SHIPPED",       tone: "neutral" },
};

/* ── finished_bats.status ──────────────────────────────────────────────── */
export const BAT_STATUS_CHIP: Record<string, ChipPreset> = {
  inventory:       { label: "INVENTORY", tone: "success" },
  sold:            { label: "SOLD",      tone: "info" },
  shipped:         { label: "COMPLETED", tone: "success" },
  pending_engrave: { label: "PENDING",   tone: "warning" },
  ready_to_ship:   { label: "READY",     tone: "warning" },
};

/* ── splitgrip_serials.status ──────────────────────────────────────────── */
export const SG_SERIAL_STATUS_CHIP: Record<string, ChipPreset> = {
  stock:    { label: "STOCK",    tone: "info" },
  assigned: { label: "ASSIGNED", tone: "gold" },
  shipped:  { label: "SHIPPED",  tone: "success" },
  blem:     { label: "BLEM",     tone: "danger" },
};

/* ── splitgrip_serials.product_line ────────────────────────────────────── */
export const SG_PRODUCT_LINE_CHIP: Record<string, ChipPreset> = {
  split_grip: { label: "SPLIT", tone: "gold" },
  polar_grip: { label: "POLAR", tone: "info" },
};

/* ── Shipping-cost breakdown ("INCOMPLETE" style flag rows) ───────────── */
export const INCOMPLETE_CHIP: ChipPreset = { label: "INCOMPLETE", tone: "warning" };
export const PRO_CHIP: ChipPreset = { label: "PRO", tone: "accent" };
export const FREE_SHIPPING_CHIP: ChipPreset = { label: "FREE SHIPPING", tone: "success" };

/** Resolve a raw stage/payment/invoice string to a ChipPreset, with fallback. */
export function resolveChip(
  map: Record<string, ChipPreset>,
  key: string | null | undefined,
  fallback: ChipPreset = { label: (key || "UNKNOWN").toUpperCase(), tone: "neutral" }
): ChipPreset {
  if (!key) return fallback;
  return map[key] ?? { ...fallback, label: key.toUpperCase().replace(/_/g, " ") };
}
