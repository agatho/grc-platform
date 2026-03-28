"use client";

import React from "react";

interface ModuleRelevance {
  ics: boolean;
  isms: boolean;
  esg: boolean;
  compliance: boolean;
  bcm: boolean;
}

interface ModuleRelevanceCheckboxesProps {
  value: ModuleRelevance;
  onChange: (value: ModuleRelevance) => void;
  disabled?: boolean;
  labels?: Record<string, string>;
}

const MODULE_KEYS: (keyof ModuleRelevance)[] = ["ics", "isms", "esg", "compliance", "bcm"];

export function ModuleRelevanceCheckboxes({
  value,
  onChange,
  disabled = false,
  labels = {},
}: ModuleRelevanceCheckboxesProps) {
  const defaultLabels: Record<string, string> = {
    ics: "ICS",
    isms: "ISMS",
    esg: "ESG",
    compliance: "Compliance",
    bcm: "BCM",
  };

  return (
    <div className="flex flex-wrap gap-4">
      {MODULE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
          />
          <span className="text-sm text-gray-700">
            {labels[key] ?? defaultLabels[key]}
          </span>
        </label>
      ))}
    </div>
  );
}
