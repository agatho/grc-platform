"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { findTabGroupForPath, isTabActive, MODULE_TAB_GROUPS } from "./module-tab-config";
import type { ModuleTabGroup } from "./module-tab-config";

// ──────────────────────────────────────────────────────────────
// ModuleTabNav — Horizontal tab bar for module sub-navigation
// ──────────────────────────────────────────────────────────────

interface ModuleTabNavProps {
  /** Explicit tab group key (auto-detected from URL if omitted) */
  groupKey?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a horizontal tab bar linking related pages within a module area.
 * Auto-detects which tab group to show based on the current URL pathname.
 *
 * Usage: `<ModuleTabNav />` — no props needed in most cases.
 * Override with `<ModuleTabNav groupKey="erm-risks" />` if auto-detection fails.
 */
export function ModuleTabNav({ groupKey, className }: ModuleTabNavProps) {
  const pathname = usePathname();
  const t = useTranslations();

  // Find the tab group either by explicit key or auto-detect from URL
  const group: ModuleTabGroup | null | undefined = groupKey
    ? MODULE_TAB_GROUPS.find((g) => g.key === groupKey)
    : findTabGroupForPath(pathname);

  if (!group || group.tabs.length <= 1) return null;

  return (
    <nav
      className={`mb-4 ${className ?? ""}`}
      aria-label="Modul-Navigation"
    >
      <div className="flex items-center gap-1 rounded-xl bg-gray-100/80 p-1 overflow-x-auto scrollbar-none">
        {group.tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          let label: string;
          try {
            label = t(tab.labelKey);
          } catch {
            // Fallback: extract last path segment
            label = tab.href.split("/").pop() ?? tab.labelKey;
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
