"use client";

import React from "react";
import { cn } from "../../utils";

interface LinkedTreatment {
  id: string;
  title: string;
  status: string;
  sharedCount: number;
}

interface NetEvaluationTabProps {
  residualLikelihood: number | null;
  residualImpact: number | null;
  grossLikelihood: number | null;
  grossImpact: number | null;
  isEditable: boolean;
  linkedTreatments: LinkedTreatment[];
  onLikelihoodChange: (value: number) => void;
  onImpactChange: (value: number) => void;
  onLinkTreatment?: () => void;
  labels?: {
    likelihood: string;
    impact: string;
    score: string;
    reduction: string;
    linkedTreatments: string;
    addTreatment: string;
    shared: string;
  };
}

const LEVELS = [1, 2, 3, 4, 5];

export function NetEvaluationTab({
  residualLikelihood,
  residualImpact,
  grossLikelihood,
  grossImpact,
  isEditable,
  linkedTreatments,
  onLikelihoodChange,
  onImpactChange,
  onLinkTreatment,
  labels,
}: NetEvaluationTabProps) {
  const grossScore = grossLikelihood && grossImpact ? grossLikelihood * grossImpact : null;
  const netScore = residualLikelihood && residualImpact ? residualLikelihood * residualImpact : null;
  const reduction = grossScore && netScore
    ? Math.round(((grossScore - netScore) / grossScore) * 100)
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
            value={residualLikelihood ?? ""}
            onChange={(e) => onLikelihoodChange(Number(e.target.value))}
            disabled={!isEditable}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.impact ?? "Impact"}
          </label>
          <select
            value={residualImpact ?? ""}
            onChange={(e) => onImpactChange(Number(e.target.value))}
            disabled={!isEditable}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.score ?? "Score"}
          </label>
          <div className="text-2xl font-bold text-gray-900">
            {netScore ?? "-"}
          </div>
        </div>

        {/* Linked Treatments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {labels?.linkedTreatments ?? "Linked Treatments"}
          </label>
          <div className="space-y-2">
            {linkedTreatments.map((treatment) => (
              <div
                key={treatment.id}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 border border-gray-200"
              >
                <span className="text-sm">{treatment.title}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    treatment.status === "completed" && "bg-green-100 text-green-700",
                    treatment.status === "in_progress" && "bg-blue-100 text-blue-700",
                    treatment.status === "planned" && "bg-gray-100 text-gray-700",
                  )}>
                    {treatment.status}
                  </span>
                  {treatment.sharedCount > 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {labels?.shared ?? "Shared"} ({treatment.sharedCount})
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isEditable && (
              <button
                type="button"
                onClick={onLinkTreatment}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                + {labels?.addTreatment ?? "Link Treatment"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Delta Visualization */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {labels?.reduction ?? "Gross to Net Movement"}
        </h3>
        {/* Mini heatmap with arrow */}
        <div className="relative">
          <div className="grid grid-cols-5 gap-1 opacity-50">
            {LEVELS.slice().reverse().map((impact) =>
              LEVELS.map((likelihood) => (
                <div
                  key={`${likelihood}-${impact}`}
                  className={cn(
                    "w-full aspect-square rounded-sm",
                    likelihood * impact >= 16 ? "bg-red-300" :
                    likelihood * impact >= 10 ? "bg-orange-200" :
                    likelihood * impact >= 6 ? "bg-yellow-200" :
                    "bg-green-200",
                  )}
                />
              )),
            )}
          </div>
          {/* Gross position marker */}
          {grossLikelihood && grossImpact && (
            <div
              className="absolute w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-md"
              style={{
                left: `${((grossLikelihood - 0.5) / 5) * 100}%`,
                top: `${((5 - grossImpact + 0.5) / 5) * 100}%`,
              }}
            />
          )}
          {/* Net position marker */}
          {residualLikelihood && residualImpact && (
            <div
              className="absolute w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-md"
              style={{
                left: `${((residualLikelihood - 0.5) / 5) * 100}%`,
                top: `${((5 - residualImpact + 0.5) / 5) * 100}%`,
              }}
            />
          )}
        </div>
        {/* Reduction percentage */}
        {reduction !== null && (
          <div className={cn(
            "mt-4 text-center text-lg font-bold",
            reduction > 0 ? "text-green-600" : "text-red-600",
          )}>
            {reduction > 0 ? `${reduction}% \u2193` : `${Math.abs(reduction)}% \u2191`}
          </div>
        )}
      </div>
    </div>
  );
}
