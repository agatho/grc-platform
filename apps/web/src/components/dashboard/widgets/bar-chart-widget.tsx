"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BarDataPoint {
  name: string;
  value: number;
  [key: string]: unknown;
}

function parseBarData(data: unknown): BarDataPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item, idx) => ({
      name:
        item.name ??
        item.label ??
        item.category ??
        item.period ??
        `Item ${idx + 1}`,
      value: Number(item.value ?? item.count ?? 0),
      ...item,
    }));
  }
  const d = data as Record<string, unknown>;
  if ("data" in d && Array.isArray(d.data)) return parseBarData(d.data);
  if ("distribution" in d && Array.isArray(d.distribution))
    return parseBarData(d.distribution);
  return [];
}

export function BarChartWidget({
  data,
  config,
  isLoading,
  error,
}: WidgetProps) {
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

  const chartData = parseBarData(data);
  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Daten verfuegbar
      </div>
    );
  }

  const color = config?.displayOptions?.color ?? "#3B82F6";
  const showLegend = config?.displayOptions?.showLegend !== false;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("de-DE")} />
        {showLegend && <Legend wrapperStyle={{ fontSize: "11px" }} />}
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
