"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";

interface TableRow {
  [key: string]: unknown;
}

function parseTableData(data: unknown): { rows: TableRow[]; columns: string[] } {
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
  const excludeKeys = new Set(["id", "orgId", "org_id", "deletedAt", "deleted_at", "createdBy", "created_by"]);
  const columns = Object.keys(rows[0]).filter((k) => !excludeKeys.has(k)).slice(0, 6); // max 6 cols

  return { rows, columns };
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return value.toLocaleString("de-DE");
  if (typeof value === "string") {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString("de-DE");
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

export function DataTableWidget({ data, config, isLoading, error }: WidgetProps) {
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
  const maxRows = config?.displayOptions?.maxRows ?? config?.displayOptions?.limit ?? 10;
  const displayRows = rows.slice(0, maxRows);

  if (displayRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Daten verfuegbar
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
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
