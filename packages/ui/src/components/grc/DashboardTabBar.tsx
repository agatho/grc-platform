"use client";

import React, { useState, useEffect } from "react";
import { cn } from "../../utils";

interface DashboardView {
  key: string;
  name: string;
  icon?: React.ReactNode;
}

interface DashboardTabBarProps {
  views: DashboardView[];
  activeKey: string;
  onTabChange: (key: string) => void;
  moduleKey: string;
}

export function DashboardTabBar({
  views,
  activeKey,
  onTabChange,
  moduleKey,
}: DashboardTabBarProps) {
  const storageKey = `dashboard_tab_${moduleKey}`;

  // Persist last selected tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, activeKey);
    }
  }, [activeKey, storageKey]);

  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="flex space-x-1 px-4 -mb-px" aria-label="Dashboard views">
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => onTabChange(view.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeKey === view.key
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            )}
          >
            {view.icon}
            {view.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
