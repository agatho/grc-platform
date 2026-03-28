"use client";

import React from "react";
import { cn } from "../../utils";

interface TrafficLightIndicatorProps {
  health: "healthy" | "warning" | "critical" | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "bg-green-500",
  warning: "bg-yellow-400",
  critical: "bg-red-500",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

export function TrafficLightIndicator({
  health,
  size = "md",
  className,
}: TrafficLightIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        HEALTH_COLORS[health ?? ""] ?? "bg-gray-300",
        SIZE_CLASSES[size],
        className,
      )}
      title={health ?? "Not evaluated"}
    />
  );
}
