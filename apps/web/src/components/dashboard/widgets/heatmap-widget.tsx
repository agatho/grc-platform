"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";

interface HeatmapCell {
  row: string | number;
  col: string | number;
  value: number;
  label?: string;
}

function parseHeatmapData(data: unknown): {
  cells: HeatmapCell[];
  rows: string[];
  cols: string[];
} {
  if (!data) return { cells: [], rows: [], cols: [] };

  let cells: HeatmapCell[] = [];
  const d = data as Record<string, unknown>;

  if ("data" in d && Array.isArray(d.data)) {
    cells = d.data;
  } else if ("cells" in d && Array.isArray(d.cells)) {
    cells = d.cells;
  } else if ("matrix" in d && Array.isArray(d.matrix)) {
    // 2D matrix format: [[1,2],[3,4]]
    const matrix = d.matrix as number[][];
    const rowLabels =
      (d.rowLabels as string[]) ?? matrix.map((_, i) => String(i + 1));
    const colLabels =
      (d.colLabels as string[]) ??
      matrix[0]?.map((_, i) => String(i + 1)) ??
      [];

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < (matrix[r]?.length ?? 0); c++) {
        cells.push({
          row: rowLabels[r] ?? String(r),
          col: colLabels[c] ?? String(c),
          value: matrix[r][c],
        });
      }
    }

    return { cells, rows: rowLabels, cols: colLabels };
  } else if (Array.isArray(data)) {
    cells = data;
  }

  const rows = [...new Set(cells.map((c) => String(c.row)))];
  const cols = [...new Set(cells.map((c) => String(c.col)))];

  return { cells, rows, cols };
}

function getHeatmapColor(value: number, maxValue: number): string {
  if (maxValue === 0) return "#f3f4f6";
  const ratio = value / maxValue;
  if (ratio >= 0.8) return "#DC2626"; // red
  if (ratio >= 0.6) return "#F97316"; // orange
  if (ratio >= 0.4) return "#EAB308"; // yellow
  if (ratio >= 0.2) return "#84CC16"; // lime
  if (ratio > 0) return "#22C55E"; // green
  return "#f3f4f6"; // gray
}

export function HeatmapWidget({ data, config, isLoading, error }: WidgetProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-full w-full animate-pulse rounded bg-muted" />
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

  const { cells, rows, cols } = parseHeatmapData(data);

  if (cells.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Daten verfuegbar
      </div>
    );
  }

  const maxValue = Math.max(...cells.map((c) => c.value), 1);
  const cellMap = new Map(cells.map((c) => [`${c.row}-${c.col}`, c]));

  return (
    <div className="flex h-full flex-col overflow-auto p-1">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {cols.map((col) => (
              <th
                key={col}
                className="p-1 text-center font-medium text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="p-1 text-right font-medium text-muted-foreground">
                {row}
              </td>
              {cols.map((col) => {
                const cell = cellMap.get(`${row}-${col}`);
                const value = cell?.value ?? 0;
                return (
                  <td
                    key={col}
                    className="p-1 text-center"
                    title={`${row} / ${col}: ${value}`}
                  >
                    <div
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded text-[10px] font-medium text-white"
                      style={{
                        backgroundColor: getHeatmapColor(value, maxValue),
                      }}
                    >
                      {value}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
