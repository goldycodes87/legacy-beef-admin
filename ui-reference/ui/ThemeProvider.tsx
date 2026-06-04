"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Theme = "bergbat" | "splitgrip";

/**
 * Route-driven theme swap. Sets `data-theme` on <html> based on pathname.
 *   /splitgrip/*  → splitgrip  (accent swaps to blue)
 *   /pro-splits/* → splitgrip  (Custom Splits Create Order is a Split Grip flow)
 *   everywhere    → bergbat    (accent stays red)
 *
 * ONLY the accent layer swaps. Sidebar nav section colors, role chips (paid/
 * turned/unpaid), and all other tokens stay identical — that's the point.
 *
 * Mounted once inside AppShell. Does not render any DOM of its own.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSplitGrip =
    pathname?.startsWith("/splitgrip") ||
    pathname?.startsWith("/pro-splits");
  const theme: Theme = isSplitGrip ? "splitgrip" : "bergbat";

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
