"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";

interface ScoreData {
  score: number;
  maxScore?: number;
  label?: string;
}

function parseScoreData(data: unknown): ScoreData {
  if (!data) return { score: 0, maxScore: 100 };
  const d = data as Record<string, unknown>;
  if ("data" in d && typeof d.data === "object") return parseScoreData(d.data);
  return {
    score: Number(d.score ?? d.value ?? d.total ?? 0),
    maxScore: Number(d.maxScore ?? d.max ?? 100),
    label: (d.label ?? d.name) as string | undefined,
  };
}

export function ComplianceScoreWidget({
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

  const scoreData = parseScoreData(data);
  const percentage = scoreData.maxScore
    ? Math.round((scoreData.score / scoreData.maxScore) * 100)
    : scoreData.score;

  const color =
    percentage >= 80
      ? "#10B981"
      : percentage >= 60
        ? "#EAB308"
        : percentage >= 40
          ? "#F97316"
          : "#EF4444";

  // SVG arc for the gauge
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex h-full flex-col items-center justify-center p-2">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Score arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>
            {percentage}%
          </span>
        </div>
      </div>
      {scoreData.label && (
        <div className="mt-2 text-xs text-muted-foreground">
          {scoreData.label}
        </div>
      )}
    </div>
  );
}
