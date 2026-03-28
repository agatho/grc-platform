"use client";

import { Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────

interface LanguageIndicatorProps {
  /** The JSONB translatable field value */
  value: Record<string, string> | string | null | undefined;
  /** Total active languages for the org */
  activeLanguageCount: number;
}

// ── Component ────────────────────────────────────────────────────

/**
 * Displays a "3/5 languages" badge to indicate translation coverage.
 * Use in list views next to entity titles.
 */
export function LanguageIndicator({
  value,
  activeLanguageCount,
}: LanguageIndicatorProps) {
  if (!value || typeof value !== "object" || activeLanguageCount <= 1) {
    return null;
  }

  const filledLanguages = Object.keys(value).filter(
    (k) => value[k] && value[k].trim() !== "",
  );
  const count = filledLanguages.length;

  if (count >= activeLanguageCount) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1 py-0">
              <Languages className="h-2.5 w-2.5 mr-0.5" />
              {count}/{activeLanguageCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {filledLanguages.map((l) => l.toUpperCase()).join(", ")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const color =
    count / activeLanguageCount >= 0.5
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-red-100 text-red-700 border-red-200";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className={`${color} text-[10px] px-1 py-0`}>
            <Languages className="h-2.5 w-2.5 mr-0.5" />
            {count}/{activeLanguageCount}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {filledLanguages.map((l) => l.toUpperCase()).join(", ")}
          {" — "}
          {activeLanguageCount - count} missing
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
