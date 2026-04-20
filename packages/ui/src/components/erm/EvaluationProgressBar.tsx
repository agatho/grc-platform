"use client";

import React from "react";
import { cn } from "../../utils";

interface EvaluationProgressBarProps {
  currentPhase: string;
  phases?: string[];
  labels?: Record<string, string>;
  onPhaseClick?: (phase: string) => void;
}

const DEFAULT_PHASES = [
  "assignment",
  "gross_evaluation",
  "net_evaluation",
  "approval",
  "active",
];

const PHASE_INDEX: Record<string, number> = {};
DEFAULT_PHASES.forEach((p, i) => {
  PHASE_INDEX[p] = i;
});

export function EvaluationProgressBar({
  currentPhase,
  phases = DEFAULT_PHASES,
  labels = {},
  onPhaseClick,
}: EvaluationProgressBarProps) {
  const currentIndex = PHASE_INDEX[currentPhase] ?? 0;

  return (
    <div className="flex items-center w-full h-14 px-4 sm:flex-row flex-col gap-2">
      {phases.map((phase, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isPending = idx > currentIndex;

        return (
          <React.Fragment key={phase}>
            {idx > 0 && (
              <div
                className={cn(
                  "h-0.5 flex-1 min-w-4",
                  isCompleted || isCurrent ? "bg-teal-600" : "bg-gray-200",
                )}
              />
            )}
            <button
              type="button"
              onClick={() => onPhaseClick?.(phase)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                isCompleted && "bg-teal-600 text-white",
                isCurrent && "border-2 border-teal-600 text-teal-600 bg-white",
                isPending && "bg-gray-100 text-gray-400",
              )}
            >
              {isCompleted && (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {isCurrent && (
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              )}
              {labels[phase] ?? phase.replace(/_/g, " ")}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
