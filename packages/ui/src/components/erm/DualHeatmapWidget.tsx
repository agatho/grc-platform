"use client";

import React from "react";
import { cn } from "../../utils";

interface RiskPoint {
  id: string;
  label: string;
  grossLikelihood: number;
  grossImpact: number;
  netLikelihood: number;
  netImpact: number;
}

interface DualHeatmapWidgetProps {
  risks: RiskPoint[];
  labels?: {
    grossTitle: string;
    netTitle: string;
  };
  onRiskClick?: (riskId: string) => void;
}

const LEVELS = [1, 2, 3, 4, 5];

function getCellColor(l: number, i: number): string {
  const score = l * i;
  if (score >= 16) return "bg-red-200";
  if (score >= 10) return "bg-orange-100";
  if (score >= 6) return "bg-yellow-100";
  return "bg-green-100";
}

function HeatmapGrid({
  risks,
  getLikelihood,
  getImpact,
  title,
  onRiskClick,
}: {
  risks: RiskPoint[];
  getLikelihood: (r: RiskPoint) => number;
  getImpact: (r: RiskPoint) => number;
  title: string;
  onRiskClick?: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2 text-center">{title}</h3>
      <div className="grid grid-cols-5 gap-0.5 relative">
        {LEVELS.slice().reverse().map((impact) =>
          LEVELS.map((likelihood) => {
            const cellRisks = risks.filter(
              (r) => getLikelihood(r) === likelihood && getImpact(r) === impact,
            );
            return (
              <div
                key={`${likelihood}-${impact}`}
                className={cn(
                  "w-full aspect-square rounded-sm flex flex-wrap items-center justify-center gap-0.5 p-0.5",
                  getCellColor(likelihood, impact),
                )}
              >
                {cellRisks.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onRiskClick?.(r.id)}
                    className="w-2.5 h-2.5 rounded-full bg-gray-800 hover:bg-teal-600 transition-colors"
                    title={r.label}
                  />
                ))}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

export function DualHeatmapWidget({
  risks,
  labels,
  onRiskClick,
}: DualHeatmapWidgetProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <HeatmapGrid
        risks={risks}
        getLikelihood={(r) => r.grossLikelihood}
        getImpact={(r) => r.grossImpact}
        title={labels?.grossTitle ?? "Gross Evaluation"}
        onRiskClick={onRiskClick}
      />
      <HeatmapGrid
        risks={risks}
        getLikelihood={(r) => r.netLikelihood}
        getImpact={(r) => r.netImpact}
        title={labels?.netTitle ?? "Net Evaluation"}
        onRiskClick={onRiskClick}
      />
    </div>
  );
}
