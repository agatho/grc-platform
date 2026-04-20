"use client";

import React from "react";
import { cn } from "../../utils";

interface IncidentRatingTabProps {
  overallSeverityRating: number | null;
  responseEffectiveness: number | null;
  communicationQuality: number | null;
  lessonsLearned: string;
  isEditable: boolean;
  onChange: (field: string, value: number | string) => void;
  labels?: {
    title: string;
    overallSeverity: string;
    responseEffectiveness: string;
    communicationQuality: string;
    lessonsLearned: string;
    lockedMessage: string;
  };
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "text-2xl transition-colors",
            (value ?? 0) >= star ? "text-yellow-400" : "text-gray-300",
            disabled
              ? "cursor-default"
              : "cursor-pointer hover:text-yellow-300",
          )}
        >
          \u2605
        </button>
      ))}
      <span className="text-sm text-gray-500 ml-2 self-center">
        ({value ?? 0}/5)
      </span>
    </div>
  );
}

export function IncidentRatingTab({
  overallSeverityRating,
  responseEffectiveness,
  communicationQuality,
  lessonsLearned,
  isEditable,
  onChange,
  labels,
}: IncidentRatingTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-900">
        {labels?.title ?? "Post-Incident Rating"}
      </h3>

      {!isEditable && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
          {labels?.lockedMessage ??
            "Rating is only available when incident is resolved or closed."}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.overallSeverity ?? "Overall Severity"}
          </label>
          <StarRating
            value={overallSeverityRating}
            onChange={(v) => onChange("overall_severity_rating", v)}
            disabled={!isEditable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.responseEffectiveness ?? "Response Effectiveness"}
          </label>
          <StarRating
            value={responseEffectiveness}
            onChange={(v) => onChange("response_effectiveness", v)}
            disabled={!isEditable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.communicationQuality ?? "Communication Quality"}
          </label>
          <StarRating
            value={communicationQuality}
            onChange={(v) => onChange("communication_quality", v)}
            disabled={!isEditable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels?.lessonsLearned ?? "Lessons Learned"}
          </label>
          <textarea
            value={lessonsLearned}
            onChange={(e) => onChange("lessons_learned", e.target.value)}
            disabled={!isEditable}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            maxLength={10000}
          />
        </div>
      </div>
    </div>
  );
}
