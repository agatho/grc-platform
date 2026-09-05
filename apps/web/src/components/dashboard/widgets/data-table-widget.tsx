"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { WidgetProps } from "../widget-registry";

interface TableRow {
  [key: string]: unknown;
}

function parseTableData(data: unknown): {
  rows: TableRow[];
  columns: string[];
} {
  if (!data) return { rows: [], columns: [] };

  let rows: TableRow[] = [];

  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if ("data" in d && Array.isArray(d.data)) {
      rows = d.data;
    } else if ("rows" in d && Array.isArray(d.rows)) {
      rows = d.rows;
    }
  }

  if (rows.length === 0) return { rows: [], columns: [] };

  // Derive columns from first row, exclude internal fields
  const excludeKeys = new Set([
    "id",
    "orgId",
    "org_id",
    "deletedAt",
    "deleted_at",
    "createdBy",
    "created_by",
  ]);
  const columns = Object.keys(rows[0])
    .filter((k) => !excludeKeys.has(k))
    .slice(0, 6); // max 6 cols

  return { rows, columns };
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Zwei getrennte Maengel in dieser einen
 * Funktion:
 *
 *  - „Ja"/„Nein" standen fest im Quelltext.
 *  - Zahlen und Datumsangaben wurden mit dem FESTEN Gebietsschema `de-DE`
 *    formatiert. Das ist die zweite, unsichtbarere Haelfte von OP-070: eine
 *    Seite kann vollstaendig uebersetzt sein und dem englischen Leser
 *    trotzdem „1.234,5" und „31.12.2026" zeigen. Die i18n-Ratsche sieht das
 *    nicht — sie prueft, ob eine Datei `useTranslations` importiert, nicht,
 *    mit welchem Gebietsschema sie formatiert.
 */
function formatCellValue(
  value: unknown,
  locale: string,
  yes: string,
  no: string,
): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? yes : no;
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value === "string") {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString(locale);
      } catch {
        return value;
      }
    }
    return value.length > 40 ? `${value.substring(0, 40)}...` : value;
  }
  return String(value);
}

function formatColumnHeader(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DataTableWidget({
  data,
  config,
  isLoading,
  error,
}: WidgetProps) {
  const t = useTranslations("dashboard.widget");
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const { rows, columns } = parseTableData(data);
  const maxRows =
    config?.displayOptions?.maxRows ?? config?.displayOptions?.limit ?? 10;
  const displayRows = rows.slice(0, maxRows);

  if (displayRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("dataUnavailable")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-1.5 text-left font-medium text-muted-foreground"
              >
                {formatColumnHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => (
            <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
              {columns.map((col) => (
                <td key={col} className="px-2 py-1.5">
                  {formatCellValue(row[col], locale, t("yes"), t("no"))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
