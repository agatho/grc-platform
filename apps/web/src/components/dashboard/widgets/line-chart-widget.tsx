"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface LineDataPoint {
  name: string;
  value: number;
  [key: string]: unknown;
}

function parseLineData(data: unknown): LineDataPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item, idx) => ({
      name:
        item.name ??
        item.label ??
        item.date ??
        item.period ??
        `Point ${idx + 1}`,
      value: Number(item.value ?? item.score ?? item.count ?? 0),
      ...item,
    }));
  }
  const d = data as Record<string, unknown>;
  if ("data" in d && Array.isArray(d.data)) return parseLineData(d.data);
  if ("trend" in d && Array.isArray(d.trend)) return parseLineData(d.trend);
  return [];
}

export function LineChartWidget({
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

  const chartData = parseLineData(data);
  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Daten verfuegbar
      </div>
    );
  }

  const color = config?.displayOptions?.color ?? "#3B82F6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("de-DE")} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
