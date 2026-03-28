"use client";

import React from "react";

interface MyBPMHomepageProps {
  recentlyViewed: { id: string; name: string; lastViewed: string }[];
  ownedProcesses: { id: string; name: string; status: string; health: string }[];
  pendingGovernance: { id: string; name: string; action: string }[];
  onProcessClick?: (processId: string) => void;
  labels?: {
    title: string;
    recentlyViewed: string;
    myProcesses: string;
    pendingActions: string;
    noRecent: string;
    noOwned: string;
    noPending: string;
  };
}

export function MyBPMHomepage({
  recentlyViewed,
  ownedProcesses,
  pendingGovernance,
  onProcessClick,
  labels,
}: MyBPMHomepageProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {labels?.title ?? "My BPM"}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recently Viewed */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {labels?.recentlyViewed ?? "Recently Viewed"}
          </h3>
          {recentlyViewed.length === 0 ? (
            <p className="text-sm text-gray-400">{labels?.noRecent ?? "No recent processes"}</p>
          ) : (
            <div className="space-y-2">
              {recentlyViewed.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                >
                  {proc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* My Processes */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {labels?.myProcesses ?? "My Processes"}
          </h3>
          {ownedProcesses.length === 0 ? (
            <p className="text-sm text-gray-400">{labels?.noOwned ?? "No owned processes"}</p>
          ) : (
            <div className="space-y-2">
              {ownedProcesses.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                >
                  <span>{proc.name}</span>
                  <span className="text-xs text-gray-400">{proc.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pending Governance */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {labels?.pendingActions ?? "Pending Actions"}
          </h3>
          {pendingGovernance.length === 0 ? (
            <p className="text-sm text-gray-400">{labels?.noPending ?? "No pending actions"}</p>
          ) : (
            <div className="space-y-2">
              {pendingGovernance.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => onProcessClick?.(proc.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-amber-700 bg-amber-50 transition-colors"
                >
                  {proc.name} - {proc.action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
