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
 * Format a monetary amount with the active locale.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-070/OP-190, Welle 6b] `formatNumber` gab es
 * seit FE-HIGH-2; fuer GELD gab es nichts, und genau deshalb steht in 19
 * Bildschirmdateien `new Intl.NumberFormat("de-DE", { style: "currency" })`.
 * Diese Form sieht weder der Detektor in `scripts/audit-i18n-usage.mjs` noch
 * der Wachposten aus Welle 5a: beide kennen nur `toLocale*("xx-XX")`. Die
 * Fundstellen sind in `docs/UMSETZUNG-WELLE-6B.md` beziffert; das Mittel
 * steht ab hier bereit, damit die Umstellung eine Zeile und keine
 * Entscheidung ist.
 *
 * Der Waehrungscode ist bewusst ein Pflichtargument: „EUR" ist eine
 * Eigenschaft des Betrags, nicht des Gebietsschemas.
 */
export function formatCurrency(
  locale: SupportedLocale | string,
  value: number | null | undefined,
  currency: string,
  opts?: Intl.NumberFormatOptions,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(tag(locale), {
    style: "currency",
    currency,
    ...opts,
  });
}

/**
 * Kompakte Waehrungsangabe fuer Achsenbeschriftungen ("1,3 Mio. €" / "€1.3M").
 *
 * [ARCTOS-FULL-2026-08-31 · Welle 8d] Ersetzt vier byteweise identische
 * Kopien von `formatCompactEUR`, je eine in den vier FAIR-Seiten. Die
 * ersetzte Fassung hatte zwei Fehler, und nur einer davon war das
 * Gebietsschema:
 *
 *   1. Sie schrieb `(v/1000).toFixed(0) + "k"`. Fuer 999.999 ergibt das
 *      **"1000k"** — direkt unter einem Tick, der "1.0M" heisst. Und 12.500
 *      wurde zu "13k". Das ist in JEDER Sprache falsch.
 *   2. Der Dezimaltrenner war fest der englische Punkt ("1.3M"), obwohl die
 *      Oberflaeche daneben deutsch formatiert war.
 *
 * `notation: "compact"` loest beides ueber CLDR: Deutsch kuerzt unterhalb
 * einer Million gar nicht ab (12.500 € bleibt 12.500 €) und schreibt darueber
 * "Mio."; Englisch kuerzt ab Tausend mit "K". `trailingZeroDisplay` haelt
 * "0 €" statt "0,0 €" auf der Nulllinie.
 *
 * Der Waehrungscode ist Pflichtargument — aus demselben Grund wie bei
 * `formatCurrency`: "EUR" gehoert zum Betrag, nicht zum Gebietsschema.
 */
export function formatCompactCurrency(
  locale: SupportedLocale | string,
  value: number | null | undefined,
  currency: string,
  opts?: Intl.NumberFormatOptions,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(tag(locale), {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
    ...opts,
  });
}

/**
 * React hook — returns memoised date/number formatters that
 * already know the active locale. Use inside any "use client"
 * component:
 *
 *   const { formatDate, formatDateTime, formatNumber, formatCurrency } =
 *     useDateFormat();
 *   return <span>{formatDate(row.createdAt)}</span>;
 *
 * For server components: import the bare functions and pass
 * `locale` from getLocale() (or the route's locale segment).
 */
export function useDateFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      formatDate: (
        d: Date | string | number | null | undefined,
        opts?: Intl.DateTimeFormatOptions,
      ) => formatDate(locale, d, opts),
      formatDateTime: (
        d: Date | string | number | null | undefined,
        opts?: Intl.DateTimeFormatOptions,
      ) => formatDateTime(locale, d, opts),
      formatNumber: (
        n: number | null | undefined,
        opts?: Intl.NumberFormatOptions,
      ) => formatNumber(locale, n, opts),
      formatCurrency: (
        n: number | null | undefined,
        currency: string,
        opts?: Intl.NumberFormatOptions,
      ) => formatCurrency(locale, n, currency, opts),
      formatCompactCurrency: (
        n: number | null | undefined,
        currency: string,
        opts?: Intl.NumberFormatOptions,
      ) => formatCompactCurrency(locale, n, currency, opts),
      locale,
    }),
    [locale],
  );
}
