"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";
import type { RiskStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Status -> style mapping
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<
  RiskStatus,
  { bg: string; text: string; border: string }
> = {
  identified: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  assessed: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  treated: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  accepted: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
  },
  closed: {
    bg: "bg-slate-200",
    text: "text-slate-600",
    border: "border-slate-300",
  },
};

// ---------------------------------------------------------------------------
// Status icons (unicode circles)
// ---------------------------------------------------------------------------

const STATUS_DOTS: Record<RiskStatus, string> = {
  identified: "#9CA3AF",
  assessed: "#3B82F6",
  treated: "#10B981",
  accepted: "#F59E0B",
  closed: "#64748B",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RiskStatusBadgeProps {
  status: RiskStatus;
}

export function RiskStatusBadge({ status }: RiskStatusBadgeProps) {
  const t = useTranslations("risk");
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.identified;
  const dotColor = STATUS_DOTS[status] ?? STATUS_DOTS.identified;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-xs gap-1.5",
        style.bg,
        style.text,
        style.border,
      )}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      {t(`status.${status}`)}
    </Badge>
  );
}
