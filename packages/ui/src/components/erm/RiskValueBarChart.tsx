"use client";

import React from "react";
import { cn } from "../../utils";

interface ValueRange {
  range: string;
  label: string;
  count: number;
  color: string;
}

interface RiskValueBarChartProps {
  distribution: { range: string; count: number }[];
  onRangeClick?: (range: string) => void;
  labels?: Record<string, string>;
}

const RANGE_CONFIG: Record<
  string,
  { label: string; color: string; order: number }
> = {
  critical: { label: "81-100", color: "bg-red-500", order: 0 },
  high: { label: "61-80", color: "bg-orange-400", order: 1 },
  medium: { label: "41-60", color: "bg-yellow-400", order: 2 },
  low: { label: "21-40", color: "bg-lime-400", order: 3 },
  minimal: { label: "1-20", color: "bg-green-500", order: 4 },
  not_evaluated: { label: "N/A", color: "bg-gray-300", order: 5 },
};

export function RiskValueBarChart({
  distribution,
  onRangeClick,
  labels = {},
}: RiskValueBarChartProps) {
  const maxCount = Math.max(...distribution.map((d) => Number(d.count)), 1);

  const sorted = [...distribution].sort((a, b) => {
    const orderA = RANGE_CONFIG[a.range]?.order ?? 99;
    const orderB = RANGE_CONFIG[b.range]?.order ?? 99;
    return orderA - orderB;
  });

  return (
    <div className="space-y-2">
      {sorted.map((item) => {
        const config = RANGE_CONFIG[item.range] ?? {
          label: item.range,
          color: "bg-gray-400",
          order: 99,
        };
        const widthPct = Math.max(4, (Number(item.count) / maxCount) * 100);

        return (
          <button
            key={item.range}
            type="button"
            onClick={() => onRangeClick?.(item.range)}
            className="w-full flex items-center gap-3 group hover:bg-gray-50 rounded-md px-2 py-1 transition-colors"
          >
            <span className="text-xs text-gray-500 w-12 text-right">
              {labels[item.range] ?? config.label}
            </span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  config.color,
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 w-8">
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
