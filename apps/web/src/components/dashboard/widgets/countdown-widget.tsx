"use client";

import React from "react";
import type { WidgetProps } from "../widget-registry";
import { Clock, AlertTriangle } from "lucide-react";

interface DeadlineItem {
  title: string;
  dueDate: string;
  daysRemaining?: number;
  module?: string;
}

function parseDeadlineData(data: unknown): DeadlineItem[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => ({
      title: item.title ?? item.name ?? item.label ?? "-",
      dueDate:
        item.dueDate ??
        item.due_date ??
        item.deadline ??
        item.startAt ??
        item.start_at ??
        "",
      daysRemaining: item.daysRemaining ?? item.days_remaining,
      module: item.module,
    }));
  }
  const d = data as Record<string, unknown>;
  if ("data" in d && Array.isArray(d.data)) return parseDeadlineData(d.data);
  return [];
}

function calculateDaysRemaining(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function CountdownWidget({
  data,
  config,
  isLoading,
  error,
}: WidgetProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const items = parseDeadlineData(data);
  const limit = config?.displayOptions?.limit ?? 5;
  const displayItems = items.slice(0, limit);

  if (displayItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine anstehenden Termine
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto p-1">
      {displayItems.map((item, idx) => {
        const days = item.daysRemaining ?? calculateDaysRemaining(item.dueDate);
        const isOverdue = days < 0;
        const isUrgent = days >= 0 && days <= 7;

        return (
          <div
            key={idx}
            className={`flex items-center justify-between rounded-md border p-2 text-xs ${
              isOverdue
                ? "border-red-200 bg-red-50"
                : isUrgent
                  ? "border-amber-200 bg-amber-50"
                  : "border-border"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {isOverdue ? (
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
              ) : (
                <Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{item.title}</span>
            </div>
            <span
              className={`ml-2 flex-shrink-0 font-medium tabular-nums ${
                isOverdue
                  ? "text-red-600"
                  : isUrgent
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }`}
            >
              {isOverdue
                ? `${Math.abs(days)}d ueberfaellig`
                : days === 0
                  ? "Heute"
                  : `${days}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
