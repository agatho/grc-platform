"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

function parseChartData(data: unknown): ChartDataPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item, idx) => ({
      name:
        item.name ??
        item.label ??
        item.status ??
        item.category ??
        `Item ${idx + 1}`,
      value: Number(item.value ?? item.count ?? 0),
      color: item.color,
    }));
  }
  const d = data as Record<string, unknown>;
  if ("data" in d && Array.isArray(d.data)) {
    return parseChartData(d.data);
  }
  if ("statusDistribution" in d && Array.isArray(d.statusDistribution)) {
    return parseChartData(d.statusDistribution);
  }
  return [];
}

export function DonutChartWidget({
  data,
  config,
  isLoading,
  error,
}: WidgetProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-24 w-24 animate-pulse rounded-full bg-muted" />
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

  const chartData = parseChartData(data);

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Daten verfuegbar
      </div>
    );
  }

  const showLegend = config?.displayOptions?.showLegend !== false;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="70%"
          dataKey="value"
          nameKey="name"
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value) => Number(value).toLocaleString("de-DE")} />
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={36}
            iconSize={10}
            wrapperStyle={{ fontSize: "11px" }}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
