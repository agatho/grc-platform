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
  // [ARCTOS-FULL-2026-08-31 · OP-049] Die Leiter trug Weiss auf rot-500
  // (3,82:1), orange-400 (2,38:1) und grün-500 (2,22:1) — und auf den
  // beiden mittleren Stufen bereits `gray-900`. Die Füllfarben sind hier
  // die AUSSAGE (Schadensindex als Ampel); sie zu verschieben hiesse, die
  // Skala zu ändern. Also bleiben alle fünf Füllungen unverändert und die
  // Schrift wird einheitlich dunkel — was die Leiter zugleich stimmiger
  // macht als vorher: 4,69 / 7,53 / 11,43 / 11,67 / 8,06:1.
  if (value >= 81) return "bg-red-500 text-gray-900";
  if (value >= 61) return "bg-orange-400 text-gray-900";
  if (value >= 41) return "bg-yellow-400 text-gray-900";
  if (value >= 21) return "bg-lime-400 text-gray-900";
  return "bg-green-500 text-gray-900";
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
