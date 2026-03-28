"use client";

import React from "react";

interface AssessmentCompletionBreadcrumbProps {
  assessmentTitle: string;
  completionPercentage: number;
}

export function AssessmentCompletionBreadcrumb({
  assessmentTitle,
  completionPercentage,
}: AssessmentCompletionBreadcrumbProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-gray-700">{assessmentTitle}</span>
      <span className="text-teal-600 font-medium">
        ({completionPercentage}%)
      </span>
    </span>
  );
}
