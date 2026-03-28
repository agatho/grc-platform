"use client";

import React, { useState, useEffect } from "react";
import { WalkthroughStep } from "./WalkthroughStep";
import { DecisionPoint } from "./DecisionPoint";

interface WalkthroughStepData {
  stepNumber: number;
  type: "task" | "decision" | "event";
  name: string;
  bpmnId: string;
  responsible: string;
  documents: string[];
  applications: string[];
  decisionOptions?: { label: string; targetStepNumber: number }[];
}

interface WalkthroughTabProps {
  steps: WalkthroughStepData[];
  processId: string;
  onPrint?: () => void;
  labels?: {
    title: string;
    reset: string;
    print: string;
    stepsHidden: string;
  };
}

export function WalkthroughTab({
  steps,
  processId,
  onPrint,
  labels,
}: WalkthroughTabProps) {
  const storageKey = `walkthrough_${processId}`;

  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [selectedDecisions, setSelectedDecisions] = useState<Map<number, number>>(new Map());

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const { checked, decisions } = JSON.parse(saved);
          setCheckedSteps(new Set(checked));
          setSelectedDecisions(new Map(Object.entries(decisions).map(([k, v]) => [Number(k), Number(v)])));
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [storageKey]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify({
        checked: Array.from(checkedSteps),
        decisions: Object.fromEntries(selectedDecisions),
      }));
    }
  }, [checkedSteps, selectedDecisions, storageKey]);

  const handleCheck = (stepNumber: number) => {
    const next = new Set(checkedSteps);
    if (next.has(stepNumber)) {
      next.delete(stepNumber);
    } else {
      next.add(stepNumber);
    }
    setCheckedSteps(next);
  };

  const handleDecision = (stepNumber: number, targetStepNumber: number) => {
    const next = new Map(selectedDecisions);
    next.set(stepNumber, targetStepNumber);
    setSelectedDecisions(next);
  };

  const handleReset = () => {
    setCheckedSteps(new Set());
    setSelectedDecisions(new Map());
    localStorage.removeItem(storageKey);
  };

  // Determine visible steps based on decision selections
  const visibleSteps = getVisibleSteps(steps, selectedDecisions);
  const hiddenCount = steps.length - visibleSteps.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {labels?.title ?? "Process Walkthrough"}
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {labels?.reset ?? "Reset"}
          </button>
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              {labels?.print ?? "Print"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {visibleSteps.map((step) => {
          if (step.type === "decision" && step.decisionOptions) {
            return (
              <DecisionPoint
                key={step.stepNumber}
                stepNumber={step.stepNumber}
                name={step.name}
                options={step.decisionOptions}
                selectedTarget={selectedDecisions.get(step.stepNumber) ?? null}
                onSelect={(target) => handleDecision(step.stepNumber, target)}
              />
            );
          }

          return (
            <WalkthroughStep
              key={step.stepNumber}
              stepNumber={step.stepNumber}
              name={step.name}
              type={step.type}
              responsible={step.responsible}
              documents={step.documents}
              applications={step.applications}
              isChecked={checkedSteps.has(step.stepNumber)}
              onCheck={() => handleCheck(step.stepNumber)}
            />
          );
        })}

        {hiddenCount > 0 && (
          <div className="text-center py-2 text-xs text-gray-400 border-t border-dashed border-gray-200">
            {labels?.stepsHidden ?? `${hiddenCount} steps hidden (not applicable)`}
          </div>
        )}
      </div>
    </div>
  );
}

function getVisibleSteps(
  steps: WalkthroughStepData[],
  decisions: Map<number, number>,
): WalkthroughStepData[] {
  // Simple visibility: if a decision is made, hide steps between decision and target
  // that aren't on the selected path
  const visible: WalkthroughStepData[] = [];
  const hiddenRanges: [number, number][] = [];

  for (const step of steps) {
    if (step.type === "decision" && step.decisionOptions && decisions.has(step.stepNumber)) {
      const selectedTarget = decisions.get(step.stepNumber)!;
      // All branches except the selected one should be hidden
      for (const option of step.decisionOptions) {
        if (option.targetStepNumber !== selectedTarget && option.targetStepNumber > step.stepNumber) {
          hiddenRanges.push([option.targetStepNumber, selectedTarget - 1]);
        }
      }
    }
  }

  for (const step of steps) {
    const isHidden = hiddenRanges.some(
      ([start, end]) => step.stepNumber >= start && step.stepNumber <= end,
    );
    if (!isHidden) {
      visible.push(step);
    }
  }

  return visible;
}
