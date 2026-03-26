"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";
import type { ControlStatus } from "@grc/shared";

const STATUS_STYLES: Record<ControlStatus, { bg: string; text: string; border: string }> = {
  designed: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  implemented: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  effective: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  ineffective: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  retired: {
    bg: "bg-slate-200",
    text: "text-slate-600",
    border: "border-slate-300",
  },
};

const STATUS_DOTS: Record<ControlStatus, string> = {
  designed: "#9CA3AF",
  implemented: "#3B82F6",
  effective: "#10B981",
  ineffective: "#EF4444",
  retired: "#475569",
};

interface ControlStatusBadgeProps {
  status: ControlStatus;
}

export function ControlStatusBadge({ status }: ControlStatusBadgeProps) {
  const t = useTranslations("controls");
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.designed;
  const dotColor = STATUS_DOTS[status] ?? STATUS_DOTS.designed;

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
