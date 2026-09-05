"use client";

import React from "react";
import { cn } from "../../utils";

interface ModuleNavBadgeProps {
  count: number;
  hasOverdue: boolean;
  className?: string;
}

export function ModuleNavBadge({
  count,
  hasOverdue,
  className,
}: ModuleNavBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold",
        // [ARCTOS-FULL-2026-08-31 · OP-049] Dies ist derselbe Baustein wie
        // der Zähler an der Glocke, den E2E-TRIAGE-4 §6.2.2 bereits
        // korrigiert hat: 10 px fett, weiss, auf `bg-red-500` = 3,82:1.
        // Dieselbe Abhilfe, damit die beiden Zähler auch gleich aussehen:
        // `bg-red-700` = 6,42:1. Blau bleibt — `--color-blue-500` ist im
        // Designsystem übersteuert und trägt Weiss mit 4,73:1.
        hasOverdue ? "bg-red-700 text-white" : "bg-blue-500 text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
