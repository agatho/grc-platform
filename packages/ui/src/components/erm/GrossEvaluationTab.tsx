"use client";

import React from "react";
import { cn } from "../../utils";

interface GrossEvaluationTabProps {
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  description: string;
  isEditable: boolean;
  riskObjectType: "risk" | "mixed_case" | "chance";
  onLikelihoodChange: (value: number) => void;
  onImpactChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onHeatmapClick?: (likelihood: number, impact: number) => void;
  labels?: {
    likelihood: string;
    impact: string;
    score: string;
    description: string;
    heatmapTitle: string;
  };
}

const LEVELS = [1, 2, 3, 4, 5];

function getHeatmapColor(likelihood: number, impact: number, isChance: boolean): string {
  const score = likelihood * impact;
  if (isChance) {
    // Inverted: high = good (green)
    if (score >= 16) return "bg-green-500";
    if (score >= 10) return "bg-green-300";
    if (score >= 6) return "bg-yellow-300";
    if (score >= 3) return "bg-orange-300";
    return "bg-red-300";
  }
  // Standard: high = bad (red)
  if (score >= 16) return "bg-red-500";
  if (score >= 10) return "bg-orange-400";
  if (score >= 6) return "bg-yellow-400";
  if (score >= 3) return "bg-yellow-200";
  return "bg-green-300";
}

export function GrossEvaluationTab({
  inherentLikelihood,
  inherentImpact,
  description,
  isEditable,
  riskObjectType,
  onLikelihoodChange,
  onImpactChange,
  onDescriptionChange,
  onHeatmapClick,
  labels,
}: GrossEvaluationTabProps) {
  const isChance = riskObjectType === "chance";
  const score = inherentLikelihood && inherentImpact
    ? inherentLikelihood * inherentImpact
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.likelihood ?? "Probability"}
          </label>
          <select
            value={inherentLikelihood ?? ""}
            onChange={(e) => onLikelihoodChange(Number(e.target.value))}
            disabled={!isEditable}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.impact ?? (isChance ? "Benefit" : "Impact")}
          </label>
          <select
            value={inherentImpact ?? ""}
            onChange={(e) => onImpactChange(Number(e.target.value))}
            disabled={!isEditable}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.score ?? "Score"}
          </label>
          <div className="text-2xl font-bold text-gray-900">
            {score ?? "-"}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.description ?? "Description"}
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={!isEditable}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* Right: Heatmap */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {labels?.heatmapTitle ?? "Heatmap Position"}
        </h3>
        <div className="grid grid-cols-5 gap-1">
          {LEVELS.slice().reverse().map((impact) =>
            LEVELS.map((likelihood) => {
              const isSelected =
                inherentLikelihood === likelihood && inherentImpact === impact;
              return (
                <button
                  key={`${likelihood}-${impact}`}
                  type="button"
                  disabled={!isEditable}
                  onClick={() => {
                    onLikelihoodChange(likelihood);
                    onImpactChange(impact);
                    onHeatmapClick?.(likelihood, impact);
                  }}
                  className={cn(
                    "w-full aspect-square rounded-sm text-xs font-medium transition-all",
                    getHeatmapColor(likelihood, impact, isChance),
                    isSelected && "ring-2 ring-offset-1 ring-gray-900 scale-110",
                    !isEditable && "cursor-default",
                  )}
                >
                  {isSelected ? "\u2022" : ""}
                </button>
              );
            }),
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{labels?.likelihood ?? "Probability"} &rarr;</span>
        </div>
      </div>
    </div>
  );
}
