"use client";

import React from "react";
import { cn } from "../../utils";

interface TodoItem {
  id: string;
  elementId: string;
  title: string;
  type: string;
  dueDate: string | null;
  isOverdue: boolean;
  entityType: string;
  link: string;
}

interface MyTodosWidgetProps {
  module: string;
  items: TodoItem[];
  totalCount: number;
  overdueCount: number;
  onItemClick?: (link: string) => void;
  title?: string;
  categories?: { key: string; label: string; icon: string }[];
}

const DEFAULT_CATEGORIES = [
  { key: "evaluation", label: "Awaiting Evaluation", icon: "\u23F3" },
  { key: "approval", label: "Awaiting Approval", icon: "\uD83D\uDC4D" },
  { key: "overdue", label: "Overdue", icon: "\u26A0\uFE0F" },
  { key: "assessment", label: "Assessments", icon: "\uD83D\uDCCB" },
  { key: "review", label: "Reviews", icon: "\uD83D\uDD0D" },
  { key: "incident", label: "Incidents", icon: "\uD83D\uDEA8" },
  { key: "treatment", label: "Treatments", icon: "\uD83D\uDD27" },
];

export function MyTodosWidget({
  module,
  items,
  totalCount,
  overdueCount,
  onItemClick,
  title,
  categories = DEFAULT_CATEGORIES,
}: MyTodosWidgetProps) {
  const groupedItems = new Map<string, TodoItem[]>();
  for (const item of items) {
    const group = groupedItems.get(item.type) ?? [];
    group.push(item);
    groupedItems.set(item.type, group);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          {title ?? `My ToDos \u2014 ${module.toUpperCase()}`}
        </h3>
        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            overdueCount > 0
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700",
          )}
        >
          {totalCount}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {categories.map((category) => {
          const categoryItems = groupedItems.get(category.key) ?? [];
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.key} className="px-4 py-3">
              <h4 className="text-xs font-medium text-gray-500 mb-2">
                {category.icon} {category.label} ({categoryItems.length})
              </h4>
              <div className="space-y-1">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick?.(item.link)}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 text-sm",
                      item.isOverdue && "border-l-4 border-red-400",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.elementId && (
                        <span className="text-xs text-gray-400 font-mono">
                          {item.elementId}
                        </span>
                      )}
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.dueDate && (
                      <span
                        className={cn(
                          "text-xs whitespace-nowrap ml-2",
                          item.isOverdue
                            ? "text-red-500 font-medium"
                            : "text-gray-400",
                        )}
                      >
                        {item.dueDate}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {totalCount === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No pending items
          </div>
        )}
      </div>
    </div>
  );
}
