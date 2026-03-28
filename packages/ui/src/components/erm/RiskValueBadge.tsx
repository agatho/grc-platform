"use client";

import React from "react";
import { cn } from "../../utils";

interface RiskValueBadgeProps {
  value: number | null | undefined;
  className?: string;
}

function getBadgeStyle(value: number | null | undefined): { bg: string; text: string; label: string } {
  if (value == null || value === 0) {
    return { bg: "bg-gray-100", text: "text-gray-500", label: "N/A" };
  }
  if (value >= 81) return { bg: "bg-red-500", text: "text-white", label: String(value) };
  if (value >= 61) return { bg: "bg-orange-400", text: "text-white", label: String(value) };
  if (value >= 41) return { bg: "bg-yellow-400", text: "text-gray-900", label: String(value) };
  if (value >= 21) return { bg: "bg-lime-400", text: "text-gray-900", label: String(value) };
  return { bg: "bg-green-500", text: "text-white", label: String(value) };
}

export function RiskValueBadge({ value, className }: RiskValueBadgeProps) {
  const style = getBadgeStyle(value);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold min-w-[2rem]",
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
