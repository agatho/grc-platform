// Locale-aware date / number formatters.
//
// #FE-HIGH-2: the frontend audit found 68 sites calling
// `.toLocaleDateString()` (and `.toLocaleString()`, `.toLocaleTimeString()`)
// WITHOUT a locale argument. Browser-default locale produces
// inconsistent output across machines — German users see
// "23.5.2026", English users see "5/23/2026", testing in a CI
// browser-without-locale gets "23/5/2026" or worse "Mon May 23
// 2026 11:00:00 GMT+0200". Snapshot tests are flakey, the audit
// log + exports are non-deterministic, and the German formats
// promised in CLAUDE.md don't actually appear in DE locale UI.
//
// This module gives every page a single hook (`useDateFormat()`)
// that reads the next-intl locale and returns helpers that always
// pass the locale explicitly. The hook returns memoised functions
// so it's safe to use inline in render bodies.
//
// Server-side: use the `formatDate*` family directly, passing the
// locale as the first arg. The same helpers, no React dependency.
//
// Per CLAUDE.md conventions:
//   DE = "dd.MM.yyyy"   → .toLocaleDateString("de-DE")
//   EN = "MM/dd/yyyy"   → .toLocaleDateString("en-US")

"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

/** Locale codes used in the app (matches next-intl's `locale` values). */
export type SupportedLocale = "de" | "en";

const LOCALE_TAG: Record<SupportedLocale, string> = {
  de: "de-DE",
  en: "en-US",
};

function tag(locale: SupportedLocale | string): string {
  return LOCALE_TAG[locale as SupportedLocale] ?? "de-DE";
}

/**
 * Format a Date / ISO-string / timestamp number as a date.
 * Default: short numeric (23.05.2026 / 05/23/2026).
 */
export function formatDate(
  locale: SupportedLocale | string,
  date: Date | string | number | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(
    tag(locale),
    opts ?? { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

/**
 * Format a Date / ISO-string / timestamp number as date + time.
 * Default: short numeric date + 24h time without seconds.
 */
export function formatDateTime(
  locale: SupportedLocale | string,
  date: Date | string | number | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(
    tag(locale),
    opts ?? {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  );
}

/** Format a number with the active locale's grouping separator. */
export function formatNumber(
  locale: SupportedLocale | string,
  value: number | null | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(tag(locale), opts);
}

/**
 * React hook — returns memoised date/number formatters that
 * already know the active locale. Use inside any "use client"
 * component:
 *
 *   const { formatDate, formatDateTime, formatNumber } = useDateFormat();
 *   return <span>{formatDate(row.createdAt)}</span>;
 *
 * For server components: import the bare functions and pass
 * `locale` from getLocale() (or the route's locale segment).
 */
export function useDateFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      formatDate: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
        formatDate(locale, d, opts),
      formatDateTime: (
        d: Date | string | number | null | undefined,
        opts?: Intl.DateTimeFormatOptions,
      ) => formatDateTime(locale, d, opts),
      formatNumber: (n: number | null | undefined, opts?: Intl.NumberFormatOptions) =>
        formatNumber(locale, n, opts),
      locale,
    }),
    [locale],
  );
}
