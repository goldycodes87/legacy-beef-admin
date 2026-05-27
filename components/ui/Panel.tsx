import { HTMLAttributes, ReactNode } from "react";

type PanelSurface = "1" | "2";
type PanelPadding = "none" | "sm" | "md" | "lg";

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  surface?: PanelSurface;
  padding?: PanelPadding;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  emphasis?: boolean;
}

const PADDING: Record<PanelPadding, string> = {
  none: "p-0",
  sm:   "p-3 sm:p-4",
  md:   "p-4 sm:p-5",
  lg:   "p-5 sm:p-6 lg:p-7",
};

export function Panel({
  surface = "1",
  padding = "md",
  title,
  subtitle,
  actions,
  emphasis,
  className = "",
  children,
  ...rest
}: PanelProps) {
  const bg = surface === "2" ? "var(--surface-2)" : "var(--surface-1)";
  const hasHeader = title || subtitle || actions;

  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: bg,
        border: "1px solid var(--border)",
        boxShadow: emphasis ? "var(--shadow-sm)" : undefined,
      }}
      {...rest}
    >
      {emphasis && (
        <div
          className="h-px w-full"
          style={{ background: "var(--accent)" }}
          aria-hidden="true"
        />
      )}
      {hasHeader && (
        <div
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="min-w-0">
            {title && (
              <div className="type-panel-title" style={{ color: "var(--text)" }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div className="type-helper mt-1">{subtitle}</div>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={PADDING[padding]}>
        {children}
      </div>
    </div>
  );
}

interface PanelSectionProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
}

export function PanelSection({
  label,
  className = "",
  children,
  ...rest
}: PanelSectionProps) {
  return (
    <section className={`space-y-3 ${className}`} {...rest}>
      {label && (
        <div className="type-section-label">{label}</div>
      )}
      {children}
    </section>
  );
}
