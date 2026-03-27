// Sprint 19: CSV injection prevention + sanitization utilities

/**
 * Sanitize a string value to prevent CSV injection.
 * Strips leading =, +, -, @, \t, \r characters that can trigger
 * formula execution when opened in Excel.
 */
export function sanitizeCsvValue(value: string): string {
  if (typeof value !== "string") return String(value ?? "");
  // Prefix dangerous characters with a single quote
  return value.replace(/^([=+\-@\t\r])/, "'$1");
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
 * Escape a field for CSV output (wrap in quotes if it contains commas, quotes, or newlines).
 */
export function escapeCsvField(field: unknown): string {
  const str = String(field ?? "");
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string with headers.
 */
export function objectsToCsv(
  data: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const headerRow = columns.map((c) => escapeCsvField(c.header)).join(",");
  const dataRows = data.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key];
        const sanitized =
          typeof value === "string" ? sanitizeCsvValue(value) : value;
        return escapeCsvField(sanitized);
      })
      .join(","),
  );
  return [headerRow, ...dataRows].join("\n");
}
