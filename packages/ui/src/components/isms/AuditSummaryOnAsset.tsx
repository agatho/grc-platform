"use client";

import React from "react";
import { cn } from "../../utils";

interface AuditSummaryOnAssetProps {
  lastAuditDate: string | null;
  lastAuditResult: string;
  auditId: string | null;
  auditTitle: string | null;
  majorFindings: number;
  labels?: {
    title: string;
    lastAuditDate: string;
    result: string;
    findings: string;
    notAudited: string;
  };
}

const RESULT_COLORS: Record<string, string> = {
  conformity: "bg-green-100 text-green-700",
  minor_non_conformity: "bg-yellow-100 text-yellow-700",
  major_non_conformity: "bg-red-100 text-red-700",
  not_audited: "bg-gray-100 text-gray-500",
};

export function AuditSummaryOnAsset({
  lastAuditDate,
  lastAuditResult,
  auditId,
  auditTitle,
  majorFindings,
  labels,
}: AuditSummaryOnAssetProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">
        {labels?.title ?? "Last Audit"}
      </h4>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {labels?.lastAuditDate ?? "Date"}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {lastAuditDate ?? (labels?.notAudited ?? "Not audited")}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {labels?.result ?? "Result"}
          </span>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            RESULT_COLORS[lastAuditResult] ?? RESULT_COLORS.not_audited,
          )}>
            {lastAuditResult.replace(/_/g, " ")}
          </span>
        </div>

        {majorFindings > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {labels?.findings ?? "Major Findings"}
            </span>
            <span className="text-sm font-bold text-red-600">{majorFindings}</span>
          </div>
        )}

        {auditId && auditTitle && (
          <a
            href={`/audit-mgmt/${auditId}`}
            className="text-sm text-teal-600 hover:text-teal-700 underline block mt-2"
          >
            {auditTitle}
          </a>
        )}
      </div>
    </div>
  );
}
