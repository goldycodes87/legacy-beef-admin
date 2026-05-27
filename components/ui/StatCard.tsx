import { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  emphasis?: boolean;
  valueColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  meta,
  aside,
  emphasis,
  valueColor,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg px-6 py-5 flex flex-col gap-2 border bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] hover:border-[color:var(--border)] transition-colors duration-200 ${className}`}
      style={
        emphasis
          ? { borderTop: "2px solid var(--accent)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="type-metric-label">{label}</div>
        {aside && <div className="flex-shrink-0">{aside}</div>}
      </div>
      <div className="type-metric-value" style={{ color: valueColor ?? "var(--text)" }}>
        {value}
      </div>
      {meta && <div className="type-helper">{meta}</div>}
    </div>
  );
}
