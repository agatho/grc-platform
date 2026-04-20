"use client";

import React from "react";
import { cn } from "../../utils";

interface ReaderModeToggleProps {
  isReaderMode: boolean;
  onToggle: (isReader: boolean) => void;
  labels?: {
    fullView: string;
    readerView: string;
  };
}

export function ReaderModeToggle({
  isReaderMode,
  onToggle,
  labels,
}: ReaderModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={cn(
          "px-3 py-1.5 text-xs font-medium transition-colors",
          !isReaderMode
            ? "bg-teal-600 text-white"
            : "bg-white text-gray-600 hover:bg-gray-50",
        )}
      >
        {labels?.fullView ?? "Full View"}
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={cn(
          "px-3 py-1.5 text-xs font-medium transition-colors border-l",
          isReaderMode
            ? "bg-teal-600 text-white"
            : "bg-white text-gray-600 hover:bg-gray-50",
        )}
      >
        {labels?.readerView ?? "Reader View"}
      </button>
    </div>
  );
}
