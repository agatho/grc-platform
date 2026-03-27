"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPIData {
  value: number | string;
  label?: string;
  previousValue?: number;
  trend?: "up" | "down" | "stable";
  trendPercent?: number;
  unit?: string;
}

function parseKPIData(data: unknown): KPIData {
  if (!data || typeof data !== "object") {
    return { value: 0, label: "-" };
  }

  const d = data as Record<string, unknown>;

  // Handle common API response shapes
  if ("total" in d) {
    return {
      value: d.total as number,
      label: d.label as string | undefined,
      previousValue: d.previousTotal as number | undefined,
    };
  }
  if ("count" in d) {
    return {
      value: d.count as number,
      label: d.label as string | undefined,
    };
  }
  if ("data" in d && typeof d.data === "object" && d.data !== null) {
    return parseKPIData(d.data);
  }
  if ("value" in d) {
    return {
      value: d.value as number | string,
      label: d.label as string | undefined,
      previousValue: d.previousValue as number | undefined,
      trend: d.trend as KPIData["trend"],
      trendPercent: d.trendPercent as number | undefined,
      unit: d.unit as string | undefined,
    };
  }

  return { value: 0, label: "-" };
}

export function KPICardWidget({ data, config, isLoading, error }: WidgetProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
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

  const kpi = parseKPIData(data);
  const color = config?.displayOptions?.color ?? "#3B82F6";
  const showTrend = config?.displayOptions?.showTrend !== false;

  const trendDirection =
    kpi.trend ??
    (kpi.previousValue !== undefined
      ? Number(kpi.value) > kpi.previousValue
        ? "up"
        : Number(kpi.value) < kpi.previousValue
          ? "down"
          : "stable"
      : undefined);

  const trendPct =
    kpi.trendPercent ??
    (kpi.previousValue && kpi.previousValue > 0
      ? Math.round(
          ((Number(kpi.value) - kpi.previousValue) / kpi.previousValue) * 100,
        )
      : undefined);

  return (
    <div className="flex h-full flex-col items-center justify-center p-2">
      <div
        className="text-3xl font-bold tabular-nums"
        style={{ color }}
      >
        {typeof kpi.value === "number"
          ? kpi.value.toLocaleString("de-DE")
          : kpi.value}
        {kpi.unit && (
          <span className="ml-1 text-lg font-normal text-muted-foreground">
            {kpi.unit}
          </span>
        )}
      </div>
      {kpi.label && (
        <div className="mt-1 text-xs text-muted-foreground">{kpi.label}</div>
      )}
      {showTrend && trendDirection && trendPct !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trendDirection === "up" && (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          )}
          {trendDirection === "down" && (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          {trendDirection === "stable" && (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span
            className={
              trendDirection === "up"
                ? "text-emerald-600"
                : trendDirection === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }
          >
            {trendPct > 0 ? "+" : ""}
            {trendPct}%
          </span>
        </div>
      )}
    </div>
  );
}
