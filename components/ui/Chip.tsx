import { HTMLAttributes, ReactNode } from "react";

export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "gold"
  | "purple";

type ChipSize = "sm" | "md";

interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: Tone;
  size?: ChipSize;
  icon?: ReactNode;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ChipSize, string> = {
  sm: "px-1.5 h-[18px] text-[10px] gap-1",
  md: "px-2 h-[22px] text-[11px] gap-1.5",
};

function toneStyle(tone: Tone): React.CSSProperties {
  switch (tone) {
    case "success":
      return { background: "var(--success-bg)", color: "var(--success-fg)", border: "1px solid var(--success-border)" };
    case "warning":
      return { background: "var(--warning-bg)", color: "var(--warning-fg)", border: "1px solid var(--warning-border)" };
    case "danger":
      return { background: "var(--danger-bg)", color: "var(--danger-fg)", border: "1px solid var(--danger-border)" };
    case "info":
      return { background: "var(--info-bg)", color: "var(--info-fg)", border: "1px solid var(--info-border)" };
    case "accent":
      return { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-border)" };
    case "gold":
      return { background: "var(--gold-bg)", color: "var(--gold-fg)", border: "1px solid var(--gold-border)" };
    case "purple":
      return { background: "var(--purple-bg)", color: "var(--purple-fg)", border: "1px solid var(--purple-border)" };
    case "neutral":
    default:
      return { background: "var(--neutral-bg)", color: "var(--neutral-fg)", border: "1px solid var(--neutral-border)" };
  }
}

export function Chip({
  tone = "neutral",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ChipProps) {
  return (
    <span
      className={[
        "type-chip inline-flex items-center rounded-[3px] whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      style={toneStyle(tone)}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
