"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";
import type { FindingSeverity } from "@grc/shared";

const SEVERITY_STYLES: Record<
  FindingSeverity,
  { bg: string; text: string; border: string }
> = {
  observation: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  recommendation: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  improvement_requirement: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
  },
  insignificant_nonconformity: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
  },
  significant_nonconformity: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
};

const SEVERITY_DOTS: Record<FindingSeverity, string> = {
  observation: "#9CA3AF",
  recommendation: "#3B82F6",
  improvement_requirement: "#EAB308",
  insignificant_nonconformity: "#F97316",
  significant_nonconformity: "#EF4444",
};

interface FindingSeverityBadgeProps {
  severity: FindingSeverity;
}

export function FindingSeverityBadge({ severity }: FindingSeverityBadgeProps) {
  const t = useTranslations("findings");
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.observation;
  const dotColor = SEVERITY_DOTS[severity] ?? SEVERITY_DOTS.observation;

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
      {t(`severity.${severity}`)}
    </Badge>
  );
}
