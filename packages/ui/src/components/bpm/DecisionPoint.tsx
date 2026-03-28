"use client";

import React from "react";
import { cn } from "../../utils";

interface DecisionOption {
  label: string;
  targetStepNumber: number;
}

interface DecisionPointProps {
  stepNumber: number;
  name: string;
  options: DecisionOption[];
  selectedTarget: number | null;
  onSelect: (targetStepNumber: number) => void;
}

export function DecisionPoint({
  stepNumber,
  name,
  options,
  selectedTarget,
  onSelect,
}: DecisionPointProps) {
  return (
    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-500 text-lg">\u26A1</span>
        <span className="text-sm font-medium text-gray-900">
          Step {stepNumber}: {name}
        </span>
      </div>
      <div className="space-y-1.5 ml-7">
        {options.map((option) => (
          <label
            key={option.targetStepNumber}
            className={cn(
              "flex items-center gap-2 cursor-pointer text-sm",
              selectedTarget === option.targetStepNumber
                ? "text-amber-700 font-medium"
                : "text-gray-600",
            )}
          >
            <input
              type="radio"
              name={`decision_${stepNumber}`}
              checked={selectedTarget === option.targetStepNumber}
              onChange={() => onSelect(option.targetStepNumber)}
              className="h-4 w-4 text-amber-600 focus:ring-amber-500"
            />
            {option.label}
            <span className="text-xs text-gray-400">
              &rarr; Step {option.targetStepNumber}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
