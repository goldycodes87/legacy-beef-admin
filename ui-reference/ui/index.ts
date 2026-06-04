/**
 * Berg Bat OS — shared UI primitives barrel.
 *
 * Usage (from any page):
 *   import { Panel, PageHeader, Button, Chip, StatusChip, PAYMENT_CHIP } from "@/app/components/ui";
 *
 * See foundation phase summary for archetype-specific composition patterns.
 */

export { PageContainer } from "./PageContainer";
export type { PageContainerVariant } from "./PageContainer";

export { PageHeader } from "./PageHeader";

export { Panel, PanelSection } from "./Panel";

export { Toolbar } from "./Toolbar";

export { Button, ButtonLink, IconButton } from "./Button";
export type { ButtonIntent, ButtonSize } from "./Button";

export { Chip, StatusChip } from "./Chip";

export { Field, Input, Select, Textarea, SearchField } from "./Field";

export { Table, THead, TBody, TFoot, TR, TH, TD } from "./Table";

export { EmptyState } from "./EmptyState";
export type { EmptyStateVariant } from "./EmptyState";

export { StatCard } from "./StatCard";

export { Skeleton } from "./Skeleton";

export { Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";

export { SegmentedControl } from "./SegmentedControl";
export type { SegmentItem } from "./SegmentedControl";

export { ThemeProvider } from "./ThemeProvider";

export { ContextBanner } from "./ContextBanner";
export { ActionFooter } from "./ActionFooter";
export { ReviewUnit } from "./ReviewUnit";

/* ── Preset chip maps (single source of truth for stage/payment/invoice) ── */
export {
  PAYMENT_CHIP,
  STAGE_CHIP,
  INVOICE_CHIP,
  BRAND_CHIP,
  BERG_ORDER_STATUS_CHIP,
  CLUBHOUSE_ORDER_STATUS_CHIP,
  BAT_STATUS_CHIP,
  SG_SERIAL_STATUS_CHIP,
  SG_PRODUCT_LINE_CHIP,
  INCOMPLETE_CHIP,
  PRO_CHIP,
  FREE_SHIPPING_CHIP,
  resolveChip,
} from "./tokens";
export type { Tone, ChipPreset } from "./tokens";
