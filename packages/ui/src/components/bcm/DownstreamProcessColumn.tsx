"use client";

import React from "react";

interface DownstreamProcess {
  id: string;
  elementId: string;
  title: string;
}

interface DownstreamProcessColumnProps {
  processes: DownstreamProcess[];
  onProcessClick?: (processId: string) => void;
}

export function DownstreamProcessColumn({
  processes,
  onProcessClick,
}: DownstreamProcessColumnProps) {
  if (processes.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {processes.map((proc) => (
        <button
          key={proc.id}
          type="button"
          onClick={() => onProcessClick?.(proc.id)}
          className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          {proc.elementId}
        </button>
      ))}
    </div>
  );
}
