"use client";

import React from "react";

interface CopyRecommendedRisksButtonProps {
  assetId: string;
  onCopy: (riskCatalogEntryIds: string[]) => void;
  isLoading?: boolean;
  label?: string;
}

export function CopyRecommendedRisksButton({
  assetId,
  onCopy,
  isLoading = false,
  label,
}: CopyRecommendedRisksButtonProps) {
  const handleClick = async () => {
    const response = await fetch(`/api/v1/isms/assets/${assetId}/recommended-risks`);
    if (!response.ok) return;
    const { data } = await response.json();
    const ids = data
      .filter((r: { isDefaultSelected: boolean }) => r.isDefaultSelected)
      .map((r: { riskCatalogEntryId: string }) => r.riskCatalogEntryId);
    onCopy(ids);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 rounded-md hover:bg-teal-100 disabled:opacity-50 transition-colors"
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {label ?? "Copy Recommended Risks"}
    </button>
  );
}
