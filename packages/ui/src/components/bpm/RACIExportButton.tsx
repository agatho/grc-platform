"use client";

import React from "react";

interface RACIExportButtonProps {
  processId: string;
  label?: string;
}

export function RACIExportButton({ processId, label }: RACIExportButtonProps) {
  const handleExport = () => {
    window.open(`/api/v1/processes/${processId}/raci/export`, "_blank");
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {label ?? "Export Excel"}
    </button>
  );
}
