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
        hasOverdue ? "bg-red-500 text-white" : "bg-blue-500 text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
