"use client";

import React from "react";
import { cn } from "../../utils";

interface DrillResultsTabProps {
  drillOutcome: "passed" | "partial" | "failed" | null;
  findingsCount: number;
  affectedAreas: string[];
  evaluationSummary: string;
  isEditable: boolean;
  onChange: (field: string, value: string | string[]) => void;
  labels?: {
    title: string;
    outcome: string;
    findingsCount: string;
    affectedAreas: string;
    evaluationSummary: string;
    passed: string;
    partial: string;
    failed: string;
  };
}

const OUTCOME_STYLES: Record<string, string> = {
  passed: "bg-green-100 text-green-700 border-green-300",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

export function DrillResultsTab({
  drillOutcome,
  findingsCount,
  affectedAreas,
  evaluationSummary,
  isEditable,
  onChange,
  labels,
}: DrillResultsTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {labels?.title ?? "Drill Results"}
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {labels?.outcome ?? "Outcome"}
        </label>
        <div className="flex gap-3">
          {(["passed", "partial", "failed"] as const).map((outcome) => (
            <button
              key={outcome}
              type="button"
              disabled={!isEditable}
              onClick={() => onChange("drill_outcome", outcome)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md border transition-colors",
                drillOutcome === outcome
                  ? OUTCOME_STYLES[outcome]
                  : "bg-white text-gray-500 border-gray-200",
                !isEditable && "opacity-50 cursor-not-allowed",
              )}
            >
              {labels?.[outcome] ?? outcome}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels?.findingsCount ?? "Findings Count"}
        </label>
        <p className="text-2xl font-bold text-gray-900">{findingsCount}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels?.affectedAreas ?? "Affected Areas"}
        </label>
        <div className="flex flex-wrap gap-2">
          {affectedAreas.map((area) => (
            <span
              key={area}
              className="px-2 py-1 text-xs bg-gray-100 rounded-md text-gray-700"
            >
              {area}
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels?.evaluationSummary ?? "Evaluation Summary"}
        </label>
        <textarea
          value={evaluationSummary}
          onChange={(e) => onChange("evaluation_summary", e.target.value)}
          disabled={!isEditable}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        />
      </div>
    </div>
  );
}
