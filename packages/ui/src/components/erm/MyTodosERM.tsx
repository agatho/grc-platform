"use client";

import React from "react";
import { cn } from "../../utils";

interface TodoItem {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  isOverdue: boolean;
  link: string;
}

interface MyTodosERMProps {
  items: TodoItem[];
  totalCount: number;
  overdueCount: number;
  onItemClick?: (link: string) => void;
  labels?: {
    title: string;
    awaitingEvaluation: string;
    awaitingApproval: string;
    overdueEvaluations: string;
    treatmentActions: string;
    noItems: string;
  };
}

export function MyTodosERM({
  items,
  totalCount,
  overdueCount,
  onItemClick,
  labels,
}: MyTodosERMProps) {
  const grouped = {
    evaluation: items.filter((i) => i.type === "evaluation"),
    approval: items.filter((i) => i.type === "approval"),
    overdue: items.filter((i) => i.type === "overdue"),
    treatment: items.filter((i) => i.type === "treatment"),
  };

  const sections = [
    {
      key: "evaluation",
      label: labels?.awaitingEvaluation ?? "Awaiting My Evaluation",
      items: grouped.evaluation,
      icon: "\u23F3",
    },
    {
      key: "approval",
      label: labels?.awaitingApproval ?? "Awaiting My Approval",
      items: grouped.approval,
      icon: "\uD83D\uDC4D",
    },
    {
      key: "overdue",
      label: labels?.overdueEvaluations ?? "Overdue Evaluations",
      items: grouped.overdue,
      icon: "\u26A0\uFE0F",
    },
    {
      key: "treatment",
      label: labels?.treatmentActions ?? "My Treatment Actions",
      items: grouped.treatment,
      icon: "\uD83D\uDD27",
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          {labels?.title ?? "My ToDos ERM"}
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
        {sections.map((section) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.key} className="px-4 py-3">
              <h4 className="text-xs font-medium text-gray-500 mb-2">
                {section.icon} {section.label} ({section.items.length})
              </h4>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick?.(item.link)}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 text-sm",
                      item.isOverdue && "border-l-4 border-red-400",
                    )}
                  >
                    <span className="truncate">{item.title}</span>
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
            {labels?.noItems ?? "No pending items"}
          </div>
        )}
      </div>
    </div>
  );
}
