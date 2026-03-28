"use client";

import React from "react";
import { cn } from "../../utils";

interface ResourceClassificationBadgeProps {
  classification: "critical" | "significant" | "non_critical" | null;
  className?: string;
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  significant: "bg-orange-100 text-orange-700",
  non_critical: "bg-green-100 text-green-700",
};

export function ResourceClassificationBadge({
  classification,
  className,
}: ResourceClassificationBadgeProps) {
  if (!classification) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        CLASSIFICATION_STYLES[classification] ?? "bg-gray-100 text-gray-600",
        className,
      )}
    >
      {classification.replace(/_/g, " ")}
    </span>
  );
}
