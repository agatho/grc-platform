"use client";

import React from "react";
import { cn } from "../../utils";

interface WalkthroughStepProps {
  stepNumber: number;
  name: string;
  type: "task" | "event" | "decision";
  responsible: string;
  documents: string[];
  applications: string[];
  isChecked: boolean;
  onCheck: () => void;
}

export function WalkthroughStep({
  stepNumber,
  name,
  type,
  responsible,
  documents,
  applications,
  isChecked,
  onCheck,
}: WalkthroughStepProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors",
        isChecked
          ? "bg-teal-50 border border-teal-200"
          : "bg-white border border-gray-200",
      )}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onCheck}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isChecked ? "text-teal-700 line-through" : "text-gray-900",
            )}
          >
            Step {stepNumber}: {name}
          </span>
          {type === "event" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">
              Event
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          {responsible && <span>Role: {responsible}</span>}
          {documents.length > 0 && <span>Docs: {documents.join(", ")}</span>}
          {applications.length > 0 && (
            <span>Apps: {applications.join(", ")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
