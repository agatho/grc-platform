"use client";

import React from "react";

interface MetroStationProps {
  processName: string;
  health: string;
  lineColor: string;
  x: number;
  y: number;
  onClick?: () => void;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
};

export function MetroStation({
  processName,
  health,
  lineColor,
  x,
  y,
  onClick,
}: MetroStationProps) {
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <circle
        cx={x}
        cy={y}
        r={14}
        fill="white"
        stroke={lineColor}
        strokeWidth={3}
      />
      <circle cx={x} cy={y} r={6} fill={HEALTH_COLORS[health] ?? "#9ca3af"} />
      <title>{processName}</title>
    </g>
  );
}
