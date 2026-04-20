"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";

interface GaugeData {
  value: number;
  maxValue?: number;
  label?: string;
  unit?: string;
}

function parseGaugeData(data: unknown): GaugeData {
  if (!data) return { value: 0, maxValue: 100 };
  const d = data as Record<string, unknown>;
  if ("data" in d && typeof d.data === "object") return parseGaugeData(d.data);
  return {
    value: Number(d.value ?? d.score ?? d.rate ?? d.percentage ?? 0),
    maxValue: Number(d.maxValue ?? d.max ?? 100),
    label: (d.label ?? d.name) as string | undefined,
    unit: (d.unit ?? "%") as string | undefined,
  };
}

export function GaugeWidget({ data, config, isLoading, error }: WidgetProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-32 animate-pulse rounded bg-muted" />
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

  const gaugeData = parseGaugeData(data);
  const maxVal = gaugeData.maxValue ?? 100;
  const percentage =
    maxVal > 0 ? Math.min((gaugeData.value / maxVal) * 100, 100) : 0;

  const color =
    config?.displayOptions?.color ??
    (percentage >= 75
      ? "#10B981"
      : percentage >= 50
        ? "#EAB308"
        : percentage >= 25
          ? "#F97316"
          : "#EF4444");

  // Semi-circle gauge using SVG
  const radius = 45;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex h-full flex-col items-center justify-center p-2">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-xl font-bold" style={{ color }}>
          {gaugeData.value.toLocaleString("de-DE")}
          {gaugeData.unit && (
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">
              {gaugeData.unit}
            </span>
          )}
        </div>
        {gaugeData.label && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {gaugeData.label}
          </div>
        )}
      </div>
    </div>
  );
}
