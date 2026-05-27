"use client";

import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse ${className}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={className}
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TFoot({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={className}
      style={{
        background: "var(--surface-1)",
        borderTop: "1px solid var(--border)",
      }}
      {...rest}
    >
      {children}
    </tfoot>
  );
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
  selected?: boolean;
  flagged?: boolean;
  accent?: string;
}

export function TR({
  interactive,
  selected,
  flagged,
  accent,
  className = "",
  style,
  children,
  ...rest
}: TRProps) {
  const borderLeft = flagged
    ? "3px solid var(--warning-fg)"
    : accent
      ? `3px solid ${accent}`
      : undefined;
  return (
    <tr
      className={[
        interactive ? "cursor-pointer transition-colors" : "",
        "[&:last-child>td]:border-b-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: selected ? "var(--accent-soft)" : undefined,
        borderLeft,
        ...style,
      }}
      onMouseEnter={
        interactive && !selected
          ? (e) => (e.currentTarget.style.background = "var(--surface-2)")
          : undefined
      }
      onMouseLeave={
        interactive && !selected
          ? (e) => (e.currentTarget.style.background = "transparent")
          : undefined
      }
      {...rest}
    >
      {children}
    </tr>
  );
}

interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

export function TH({
  align = "left",
  sortable,
  className = "",
  children,
  ...rest
}: THProps) {
  return (
    <th
      scope="col"
      className={[
        "type-table-header px-4 py-3",
        `text-${align}`,
        sortable ? "cursor-pointer select-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  muted?: boolean;
  numeric?: boolean;
}

export function TD({
  align = "left",
  muted,
  numeric,
  className = "",
  style,
  children,
  ...rest
}: TDProps) {
  return (
    <td
      className={[
        "type-table-cell px-4 py-3",
        `text-${align}`,
        numeric ? "type-mono" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: muted ? "var(--text-muted)" : "var(--text)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </td>
  );
}
