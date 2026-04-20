"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// CIA Level definitions
// ---------------------------------------------------------------------------

const CIA_LEVELS = [
  {
    value: 1,
    key: "low",
    bg: "bg-green-500",
    hover: "hover:bg-green-600",
    ring: "ring-green-300",
  },
  {
    value: 2,
    key: "medium",
    bg: "bg-yellow-500",
    hover: "hover:bg-yellow-600",
    ring: "ring-yellow-300",
  },
  {
    value: 3,
    key: "high",
    bg: "bg-orange-500",
    hover: "hover:bg-orange-600",
    ring: "ring-orange-300",
  },
  {
    value: 4,
    key: "veryHigh",
    bg: "bg-red-500",
    hover: "hover:bg-red-600",
    ring: "ring-red-300",
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CiaColorBarProps {
  /** Label displayed above the color bar */
  label: string;
  /** Currently selected value (1-4) or null if not set */
  value: number | null;
  /** Callback when a level is selected */
  onChange?: (value: number | null) => void;
  /** When true, the bar is non-interactive */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CiaColorBar({
  label,
  value,
  onChange,
  readOnly = false,
}: CiaColorBarProps) {
  const t = useTranslations("cia");

  const handleClick = (levelValue: number) => {
    if (readOnly || !onChange) return;
    // Toggle off if clicking the already-selected level
    if (value === levelValue) {
      onChange(null);
    } else {
      onChange(levelValue);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {value !== null && (
          <span className="text-xs text-gray-500">
            {t(`levels.${CIA_LEVELS[value - 1].key}`)}
          </span>
        )}
        {value === null && (
          <span className="text-xs text-gray-400">{t("notSet")}</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {CIA_LEVELS.map((level) => {
          const isSelected = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              disabled={readOnly}
              onClick={() => handleClick(level.value)}
              className={cn(
                "relative flex h-9 flex-1 items-center justify-center rounded-md text-xs font-medium text-white transition-all",
                level.bg,
                !readOnly && level.hover,
                !readOnly && "cursor-pointer",
                readOnly && "cursor-default opacity-80",
                isSelected && `ring-2 ${level.ring} ring-offset-1`,
                !isSelected && !readOnly && "opacity-50 hover:opacity-75",
              )}
              title={t(`levels.${level.key}`)}
              aria-label={t(`levels.${level.key}`)}
              aria-pressed={isSelected}
            >
              {isSelected && <Check size={16} strokeWidth={3} />}
              {!isSelected && (
                <span className="text-[10px] font-semibold opacity-90">
                  {level.value}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: protection goal class color
// ---------------------------------------------------------------------------

export function protectionGoalClassColor(
  pgc: number | null | undefined,
): string {
  if (pgc == null) return "bg-gray-200 text-gray-600";
  if (pgc <= 1) return "bg-green-100 text-green-800";
  if (pgc <= 2) return "bg-yellow-100 text-yellow-800";
  if (pgc <= 3) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function protectionGoalClassLabel(
  pgc: number | null | undefined,
  t: (key: string) => string,
): string {
  if (pgc == null) return t("notSet");
  if (pgc <= 1) return t("levels.low");
  if (pgc <= 2) return t("levels.medium");
  if (pgc <= 3) return t("levels.high");
  return t("levels.veryHigh");
}
