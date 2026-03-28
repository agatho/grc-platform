"use client";

import React, { useState } from "react";

interface ManagementSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: { periodStart: string; periodEnd: string; language: "de" | "en" }) => void;
  isLoading?: boolean;
  labels?: {
    title: string;
    periodStart: string;
    periodEnd: string;
    language: string;
    german: string;
    english: string;
    generate: string;
    cancel: string;
    generating: string;
  };
}

export function ManagementSummaryDialog({
  isOpen,
  onClose,
  onGenerate,
  isLoading = false,
  labels,
}: ManagementSummaryDialogProps) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {labels?.title ?? "Generate Management Summary"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {labels?.periodStart ?? "Period Start"}
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {labels?.periodEnd ?? "Period End"}
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {labels?.language ?? "Language"}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "de" | "en")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="de">{labels?.german ?? "Deutsch"}</option>
              <option value="en">{labels?.english ?? "English"}</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            {labels?.cancel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() =>
              onGenerate({
                periodStart: new Date(periodStart).toISOString(),
                periodEnd: new Date(periodEnd).toISOString(),
                language,
              })
            }
            disabled={isLoading || !periodStart || !periodEnd}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
          >
            {isLoading ? (labels?.generating ?? "Generating...") : (labels?.generate ?? "Generate Report")}
          </button>
        </div>
      </div>
    </div>
  );
}
