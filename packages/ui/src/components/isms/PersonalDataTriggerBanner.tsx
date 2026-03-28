"use client";

import React from "react";

interface PersonalDataTriggerBannerProps {
  isTriggered: boolean;
  dataBreachId?: string;
  labels?: {
    message: string;
    linkText: string;
  };
}

export function PersonalDataTriggerBanner({
  isTriggered,
  dataBreachId,
  labels,
}: PersonalDataTriggerBannerProps) {
  if (!isTriggered) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <span className="text-amber-500 text-lg">\u26A0\uFE0F</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">
          {labels?.message ?? "Data Breach workflow has been initiated. DPO has been notified."}
        </p>
      </div>
      {dataBreachId && (
        <a
          href={`/dpms/data-breaches/${dataBreachId}`}
          className="text-sm font-medium text-amber-700 hover:text-amber-800 underline"
        >
          {labels?.linkText ?? "View Data Breach"}
        </a>
      )}
    </div>
  );
}
