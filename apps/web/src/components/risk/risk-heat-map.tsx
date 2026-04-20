"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeatMapCell {
  likelihood: number;
  impact: number;
  count: number;
  risks?: Array<{ id: string; title: string }>;
}

export interface RiskHeatMapProps {
  cells: HeatMapCell[];
  mode: "inherent" | "residual";
  onCellClick?: (cell: HeatMapCell | null) => void;
  selectedCell?: { likelihood: number; impact: number } | null;
  appetiteThreshold?: number;
}

// ---------------------------------------------------------------------------
// Color logic matching the 5x5 matrix score ranges
// ---------------------------------------------------------------------------

const SCORE_COLORS: Array<{ max: number; bg: string; label: string }> = [
  { max: 4, bg: "#27AE60", label: "low" },
  { max: 8, bg: "#F1C40F", label: "medium" },
  { max: 14, bg: "#E67E22", label: "high" },
  { max: 19, bg: "#E74C3C", label: "veryHigh" },
  { max: 25, bg: "#8E44AD", label: "critical" },
];

function getScoreColor(score: number): string {
  for (const range of SCORE_COLORS) {
    if (score <= range.max) return range.bg;
  }
  return "#8E44AD";
}

// ---------------------------------------------------------------------------
// Scale labels (1-5)
// ---------------------------------------------------------------------------

const LEVELS = [1, 2, 3, 4, 5] as const;
const LIKELIHOOD_KEYS = [
  "veryLow",
  "low",
  "medium",
  "high",
  "veryHigh",
] as const;
const IMPACT_KEYS = ["veryLow", "low", "medium", "high", "veryHigh"] as const;

// ---------------------------------------------------------------------------
// RiskHeatMap Component
// ---------------------------------------------------------------------------

export function RiskHeatMap({
  cells,
  mode,
  onCellClick,
  selectedCell,
  appetiteThreshold,
}: RiskHeatMapProps) {
  const t = useTranslations("risk");
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  // Listen for resize
  if (typeof window !== "undefined") {
    useMemo(() => {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  }

  // Build lookup: `${likelihood}-${impact}` -> cell
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatMapCell>();
    for (const cell of cells) {
      map.set(`${cell.likelihood}-${cell.impact}`, cell);
    }
    return map;
  }, [cells]);

  const handleCellClick = useCallback(
    (likelihood: number, impact: number) => {
      if (!onCellClick) return;
      // Toggle off if clicking same cell
      if (
        selectedCell &&
        selectedCell.likelihood === likelihood &&
        selectedCell.impact === impact
      ) {
        onCellClick(null);
        return;
      }
      const cell = cellMap.get(`${likelihood}-${impact}`) ?? {
        likelihood,
        impact,
        count: 0,
        risks: [],
      };
      onCellClick(cell);
    },
    [onCellClick, selectedCell, cellMap],
  );

  const hasSelection = selectedCell !== null && selectedCell !== undefined;

  // Mobile fallback: sorted list instead of grid
  if (windowWidth < 480) {
    return <MobileFallback cells={cells} mode={mode} t={t} />;
  }

  // Determine cell size based on viewport
  const cellSize = windowWidth < 768 ? 40 : windowWidth < 1024 ? 60 : 80;
  const fontSize = cellSize < 60 ? "text-xs" : "text-sm";

  return (
    <div className="space-y-4">
      {/* Mode label */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {mode === "inherent" ? t("heatmap.inherent") : t("heatmap.residual")}
        </span>
        {appetiteThreshold !== undefined && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            {t("appetite.threshold")}: {appetiteThreshold}
          </span>
        )}
      </div>

      <div className="flex items-end gap-0">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center mr-1">
          <span
            className="text-xs font-semibold text-gray-500 writing-mode-vertical"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
            }}
          >
            {t("heatmap.likelihood")}
          </span>
        </div>

        {/* Y-axis scale labels + grid */}
        <div className="flex flex-col">
          <div className="flex">
            {/* Y-axis scale labels */}
            <div className="flex flex-col-reverse gap-px mr-1">
              {LEVELS.map((level, idx) => (
                <div
                  key={level}
                  className="flex items-center justify-end"
                  style={{ height: cellSize }}
                >
                  <span className="text-[10px] text-gray-500 font-medium truncate max-w-[56px] text-right mr-1">
                    {level} - {t(`likelihood.${LIKELIHOOD_KEYS[idx]}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* 5x5 Grid */}
            <div className="flex flex-col-reverse gap-px">
              {LEVELS.map((likelihood) => (
                <div key={likelihood} className="flex gap-px">
                  {LEVELS.map((impact) => {
                    const score = likelihood * impact;
                    const cell = cellMap.get(`${likelihood}-${impact}`);
                    const cellCount = cell?.count ?? 0;
                    const color = getScoreColor(score);
                    const isSelected =
                      selectedCell?.likelihood === likelihood &&
                      selectedCell?.impact === impact;
                    const isDimmed = hasSelection && !isSelected;
                    const exceedsAppetite =
                      appetiteThreshold !== undefined &&
                      score >= appetiteThreshold;

                    return (
                      <button
                        key={`${likelihood}-${impact}`}
                        type="button"
                        className={cn(
                          "relative flex items-center justify-center rounded-sm transition-all duration-150",
                          onCellClick
                            ? "cursor-pointer hover:scale-105 hover:shadow-md"
                            : "cursor-default",
                          isSelected &&
                            "ring-2 ring-white ring-offset-1 ring-offset-gray-800 z-10",
                          isDimmed && "opacity-60",
                        )}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: color,
                          border: isSelected
                            ? "2px dashed white"
                            : exceedsAppetite
                              ? "2px solid rgba(220, 38, 38, 0.6)"
                              : "1px solid rgba(255,255,255,0.2)",
                        }}
                        onClick={() => handleCellClick(likelihood, impact)}
                        title={`${t("heatmap.likelihood")}: ${likelihood}, ${t("heatmap.impact")}: ${impact} — Score: ${score} (${cellCount} ${cellCount === 1 ? "risk" : "risks"})`}
                        aria-label={`Score ${score}, ${cellCount} risks`}
                      >
                        {cellCount > 0 && cellCount <= 3 ? (
                          <div className="flex items-center justify-center gap-0.5 flex-wrap">
                            {Array.from({ length: cellCount }).map((_, i) => (
                              <div
                                key={i}
                                className="h-2.5 w-2.5 rounded-full bg-white shadow-sm"
                                style={{
                                  boxShadow: "0 0 2px rgba(0,0,0,0.3)",
                                }}
                              />
                            ))}
                          </div>
                        ) : cellCount > 3 ? (
                          <span
                            className={cn(
                              "font-bold text-white drop-shadow-sm",
                              fontSize,
                            )}
                          >
                            {cellCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* X-axis scale labels */}
          <div className="flex gap-px" style={{ marginLeft: 57 }}>
            {LEVELS.map((level, idx) => (
              <div
                key={level}
                className="flex flex-col items-center"
                style={{ width: cellSize }}
              >
                <span className="text-[10px] text-gray-500 font-medium mt-1 truncate max-w-[76px]">
                  {level} - {t(`impact.${IMPACT_KEYS[idx]}`)}
                </span>
              </div>
            ))}
          </div>

          {/* X-axis label */}
          <div className="flex justify-center mt-1" style={{ marginLeft: 57 }}>
            <span className="text-xs font-semibold text-gray-500 tracking-wide">
              {t("heatmap.impact")}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {SCORE_COLORS.map((range, i) => {
          const min = i === 0 ? 1 : SCORE_COLORS[i - 1].max + 1;
          return (
            <div key={range.label} className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: range.bg }}
              />
              <span className="text-[10px] text-gray-500">
                {min}-{range.max} {t(`score.${range.label}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      {onCellClick && (
        <p className="text-xs text-gray-400">{t("heatmap.clickToFilter")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Fallback (< 480px)
// ---------------------------------------------------------------------------

function MobileFallback({
  cells,
  mode,
  t,
}: {
  cells: HeatMapCell[];
  mode: "inherent" | "residual";
  t: ReturnType<typeof useTranslations>;
}) {
  // Sort cells by score descending, then by count descending
  const sortedCells = useMemo(() => {
    return [...cells]
      .map((c) => ({ ...c, score: c.likelihood * c.impact }))
      .sort((a, b) => b.score - a.score || b.count - a.count);
  }, [cells]);

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium text-gray-700">
        {mode === "inherent" ? t("heatmap.inherent") : t("heatmap.residual")}
      </span>
      <div className="space-y-1">
        {sortedCells.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {t("empty.noRisks")}
          </p>
        ) : (
          sortedCells.map((cell) => (
            <div
              key={`${cell.likelihood}-${cell.impact}`}
              className="flex items-center justify-between rounded-md px-3 py-2"
              style={{ backgroundColor: getScoreColor(cell.score) + "20" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: getScoreColor(cell.score) }}
                />
                <span className="text-sm font-medium text-gray-800">
                  L{cell.likelihood} x I{cell.impact} = {cell.score}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-700">
                {cell.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
