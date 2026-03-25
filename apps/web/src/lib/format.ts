// Date, number, and percentage formatting helpers (S1-20)
// Uses Intl.DateTimeFormat and Intl.NumberFormat for locale-aware formatting.
// Conventions per CLAUDE.md:
//   DE: dd.MM.yyyy / 1.234,56
//   EN: MM/dd/yyyy / 1,234.56

const LOCALE_MAP: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
};

function resolveLocale(locale: string): string {
  return LOCALE_MAP[locale] ?? LOCALE_MAP.de;
}

function toDate(date: string | Date): Date {
  return typeof date === "string" ? new Date(date) : date;
}

/**
 * Format a date as a short date string.
 * DE: dd.MM.yyyy (e.g., 25.03.2026)
 * EN: MM/dd/yyyy (e.g., 03/25/2026)
 */
export function formatDate(date: string | Date, locale: string = "de"): string {
  const d = toDate(date);
  const resolved = resolveLocale(locale);

  // Intl.DateTimeFormat with explicit 2-digit parts for consistent output
  const fmt = new Intl.DateTimeFormat(resolved, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(d);
}

/**
 * Format a date with time.
 * DE: dd.MM.yyyy HH:mm (e.g., 25.03.2026 14:30)
 * EN: MM/dd/yyyy h:mm AM/PM (e.g., 03/25/2026 2:30 PM)
 */
export function formatDateTime(date: string | Date, locale: string = "de"): string {
  const d = toDate(date);
  const resolved = resolveLocale(locale);

  if (locale === "en") {
    // EN: MM/dd/yyyy h:mm AM/PM
    const datePart = new Intl.DateTimeFormat(resolved, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);

    const timePart = new Intl.DateTimeFormat(resolved, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    return `${datePart} ${timePart}`;
  }

  // DE: dd.MM.yyyy HH:mm
  const datePart = new Intl.DateTimeFormat(resolved, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);

  const timePart = new Intl.DateTimeFormat(resolved, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  return `${datePart} ${timePart}`;
}

/**
 * Format a number with locale-appropriate grouping and decimal separators.
 * DE: 1.234,56
 * EN: 1,234.56
 */
export function formatNumber(
  num: number,
  locale: string = "de",
  options?: Intl.NumberFormatOptions,
): string {
  const resolved = resolveLocale(locale);
  return new Intl.NumberFormat(resolved, options).format(num);
}

/**
 * Format a number as a percentage.
 * DE: 85,5 % (with non-breaking space before %)
 * EN: 85.5%
 */
export function formatPercent(num: number, locale: string = "de"): string {
  const resolved = resolveLocale(locale);
  // Intl percent style multiplies by 100, so divide first
  const fmt = new Intl.NumberFormat(resolved, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return fmt.format(num / 100);
}
