"use client";

import React from "react";
import { cn } from "../../utils";

interface TripleTypeToggleProps {
  value: "risk" | "mixed_case" | "chance";
  onChange: (value: "risk" | "mixed_case" | "chance") => void;
  labels?: { risk: string; mixed_case: string; chance: string };
  disabled?: boolean;
}

const DEFAULT_LABELS = {
  risk: "Risk",
  mixed_case: "Mixed Case",
  chance: "Chance",
};

export function TripleTypeToggle({
  value,
  onChange,
  labels = DEFAULT_LABELS,
  disabled = false,
}: TripleTypeToggleProps) {
  const options: Array<{ key: "risk" | "mixed_case" | "chance"; label: string }> = [
    { key: "risk", label: labels.risk },
    { key: "mixed_case", label: labels.mixed_case },
    { key: "chance", label: labels.chance },
  ];

  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.key)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-r last:border-r-0",
            value === option.key
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
