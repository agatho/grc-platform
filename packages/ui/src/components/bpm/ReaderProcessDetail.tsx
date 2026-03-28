"use client";

import React from "react";

interface ReaderProcessDetailProps {
  processId: string;
  processTitle: string;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  labels?: {
    bpmn: string;
    raci: string;
    walkthrough: string;
    documents: string;
    risks: string;
  };
}

const READER_TABS = ["bpmn", "raci", "walkthrough", "documents", "risks"];

export function ReaderProcessDetail({
  processId,
  processTitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  labels,
}: ReaderProcessDetailProps) {
  const tabLabels: Record<string, string> = {
    bpmn: labels?.bpmn ?? "BPMN",
    raci: labels?.raci ?? "RACI",
    walkthrough: labels?.walkthrough ?? "Walkthrough",
    documents: labels?.documents ?? "Documents",
    risks: labels?.risks ?? "Risks",
  };

  // Filter to only reader-allowed tabs
  const visibleTabs = tabs.filter((t) => READER_TABS.includes(t));

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{processTitle}</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1 -mb-px">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabLabels[tab] ?? tab}
            </button>
          ))}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
