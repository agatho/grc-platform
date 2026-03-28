"use client";

import React from "react";
import { cn } from "../../utils";

interface DamageIndexBadgeProps {
  value: number | null | undefined;
  showTooltip?: boolean;
  tooltipText?: string;
  className?: string;
}

function getColor(value: number): string {
  if (value >= 81) return "bg-red-500 text-white";
  if (value >= 61) return "bg-orange-400 text-white";
  if (value >= 41) return "bg-yellow-400 text-gray-900";
  if (value >= 21) return "bg-lime-400 text-gray-900";
  return "bg-green-500 text-white";
}

export function DamageIndexBadge({
  value,
  showTooltip = false,
  tooltipText,
  className,
}: DamageIndexBadgeProps) {
  if (value == null) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
        getColor(value),
        className,
      )}
      title={showTooltip ? tooltipText : undefined}
    >
      DI: {value}
    </span>
  );
}
