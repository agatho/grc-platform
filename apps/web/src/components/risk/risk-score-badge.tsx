"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

// ---------------------------------------------------------------------------
// Score -> color & label mapping (matches heat map ranges)
// ---------------------------------------------------------------------------

function getScoreConfig(score: number): {
  bg: string;
  text: string;
  labelKey: string;
} {
  if (score <= 4)
    return { bg: "bg-emerald-100", text: "text-emerald-800", labelKey: "low" };
  if (score <= 8)
    return { bg: "bg-yellow-100", text: "text-yellow-800", labelKey: "medium" };
  if (score <= 14)
    return { bg: "bg-orange-100", text: "text-orange-800", labelKey: "high" };
  if (score <= 19)
    return { bg: "bg-red-100", text: "text-red-800", labelKey: "veryHigh" };
  return { bg: "bg-purple-100", text: "text-purple-800", labelKey: "critical" };
}

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-2.5 py-1",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskScoreBadge({ score, size = "md" }: RiskScoreBadgeProps) {
  const t = useTranslations("risk");

  if (score === null || score === undefined) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-gray-200 bg-gray-50 text-gray-400 font-normal",
          SIZE_CLASSES[size],
        )}
      >
        --
      </Badge>
    );
  }

  const config = getScoreConfig(score);

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold border-transparent",
        config.bg,
        config.text,
        SIZE_CLASSES[size],
      )}
    >
      <span className="font-bold mr-1">{score}</span>
      <span className="font-normal">{t(`score.${config.labelKey}`)}</span>
    </Badge>
  );
}
