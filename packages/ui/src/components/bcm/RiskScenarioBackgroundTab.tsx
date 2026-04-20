"use client";

import React from "react";

interface RiskScenarioBackgroundTabProps {
  usedMethods: string[];
  otherMethods: string;
  attachmentUrl: string | null;
  linkedCatalogEntry: { id: string; title: string } | null;
  linkedVulnerability: { id: string; title: string } | null;
  linkedThreat: { id: string; title: string } | null;
  labels?: {
    riskIdentification: string;
    usedMethods: string;
    otherMethods: string;
    attachment: string;
    riskDerivation: string;
    catalogEntry: string;
    vulnerability: string;
    threat: string;
  };
}

export function RiskScenarioBackgroundTab({
  usedMethods,
  otherMethods,
  attachmentUrl,
  linkedCatalogEntry,
  linkedVulnerability,
  linkedThreat,
  labels,
}: RiskScenarioBackgroundTabProps) {
  return (
    <div className="space-y-6">
      {/* Risk Identification */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          {labels?.riskIdentification ?? "Risk Identification"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {labels?.usedMethods ?? "Used Methods"}
            </label>
            <div className="flex flex-wrap gap-2">
              {usedMethods.map((method) => (
                <span
                  key={method}
                  className="px-2 py-1 text-xs bg-gray-100 rounded-md text-gray-700"
                >
                  {method}
                </span>
              ))}
              {usedMethods.length === 0 && (
                <span className="text-sm text-gray-400 italic">
                  None specified
                </span>
              )}
            </div>
          </div>

          {otherMethods && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {labels?.otherMethods ?? "Other Methods"}
              </label>
              <p className="text-sm text-gray-700">{otherMethods}</p>
            </div>
          )}

          {attachmentUrl && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {labels?.attachment ?? "Attachment"}
              </label>
              <a
                href={attachmentUrl}
                className="text-sm text-teal-600 hover:text-teal-700 underline"
              >
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Risk Derivation (read-only references) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          {labels?.riskDerivation ?? "Risk Derivation"}
        </h3>
        <div className="space-y-2">
          {linkedCatalogEntry && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
              <span className="text-xs text-gray-500">
                {labels?.catalogEntry ?? "Catalog Entry"}
              </span>
              <span className="text-sm text-gray-700">
                {linkedCatalogEntry.title}
              </span>
            </div>
          )}
          {linkedVulnerability && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
              <span className="text-xs text-gray-500">
                {labels?.vulnerability ?? "Vulnerability"}
              </span>
              <span className="text-sm text-gray-700">
                {linkedVulnerability.title}
              </span>
            </div>
          )}
          {linkedThreat && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
              <span className="text-xs text-gray-500">
                {labels?.threat ?? "Threat"}
              </span>
              <span className="text-sm text-gray-700">
                {linkedThreat.title}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
