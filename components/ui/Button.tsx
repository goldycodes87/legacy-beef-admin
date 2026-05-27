"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import Link from "next/link";

export type ButtonIntent =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "gold"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

interface BaseButtonProps {
  intent?: ButtonIntent;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
  loading?: boolean;
}

type ButtonProps = BaseButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement>;

type LinkButtonProps = BaseButtonProps & {
  href: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-10 px-4 text-xs",
  lg: "h-12 px-5 text-sm",
};

function intentStyle(intent: ButtonIntent): React.CSSProperties {
  switch (intent) {
    case "primary":
      return {
        background: "var(--accent)",
        color: "var(--accent-on)",
        border: "1px solid var(--accent)",
      };
    case "secondary":
      return {
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--border-strong)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--text-secondary)",
        border: "1px solid transparent",
      };
    case "danger":
      return {
        background: "var(--danger-bg)",
        color: "var(--danger-fg)",
        border: "1px solid var(--danger-border)",
      };
    case "gold":
      return {
        background: "var(--bergbat-gold)",
        color: "#1a1a0a",
        border: "1px solid var(--bergbat-gold)",
      };
    case "success":
      return {
        background: "var(--success-bg)",
        color: "var(--success-fg)",
        border: "1px solid var(--success-border)",
      };
  }
}

function baseClass(size: ButtonSize, block: boolean | undefined, className?: string) {
  return [
    "type-button",
    "inline-flex items-center justify-center gap-2",
    "rounded-md select-none cursor-pointer",
    "transition-[background,color,border,opacity] duration-150",
    "hover:opacity-[0.88]",
    "active:scale-[0.98]",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:opacity-40",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    SIZE_CLASSES[size],
    block ? "w-full" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    intent = "primary",
    size = "md",
    leading,
    trailing,
    block,
    loading,
    className,
    children,
    disabled,
    style,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={baseClass(size, block, className)}
      style={{ ...intentStyle(intent), ...style }}
      {...rest}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
});

export function ButtonLink({
  intent = "primary",
  size = "md",
  leading,
  trailing,
  block,
  href,
  target,
  rel,
  onClick,
  className,
  style,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className={baseClass(size, block, className)}
      style={{ ...intentStyle(intent), ...style }}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  intent?: ButtonIntent;
  "aria-label": string;
}

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { intent = "ghost", size = "md", className, children, style, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center justify-center rounded-md cursor-pointer",
          "transition-[background,color,border,opacity] duration-150",
          "hover:opacity-[0.88]",
          "active:scale-[0.96]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40",
          ICON_SIZE[size],
          className || "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ...intentStyle(intent), ...style }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
