"use client";

import { useTranslations } from "next-intl";
import { cn } from "@grc/ui";
import type { ProcessStatus } from "@grc/shared";

const STATUS_STYLES: Record<ProcessStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-red-100 text-red-700",
};

const STATUS_DOTS: Record<ProcessStatus, string> = {
  draft: "bg-gray-400",
  in_review: "bg-yellow-500",
  approved: "bg-blue-500",
  published: "bg-green-500",
  archived: "bg-red-500",
};

interface ProcessStatusBadgeProps {
  status: ProcessStatus;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

export function ProcessStatusBadge({
  status,
  size = "md",
  showDot = true,
  className,
}: ProcessStatusBadgeProps) {
  const t = useTranslations("process");

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
    lg: "text-sm px-3 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        STATUS_STYLES[status],
        sizeClasses[size],
        className,
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])} />
      )}
      {t(`status.${status}`)}
    </span>
  );
}

/** Colored dot only (used in tree view) */
export function ProcessStatusDot({
  status,
  className,
}: {
  status: ProcessStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        STATUS_DOTS[status],
        className,
      )}
      title={status}
    />
  );
}
