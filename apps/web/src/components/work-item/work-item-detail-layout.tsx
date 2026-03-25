"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, History, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getLucideIcon } from "@/components/module/icon-map";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface StatusOption {
  value: string;
  label: string;
}

interface WorkItemDetailLayoutProps {
  workItemId: string | null;
  workItemType: string;
  elementId: string | null;
  name: string;
  status: string;
  statusOptions: StatusOption[];
  onStatusChange: (newStatus: string) => Promise<void>;
  tabs: Tab[];
  icon?: string;
  children?: React.ReactNode;
}

export function WorkItemDetailLayout({
  workItemId,
  workItemType,
  elementId,
  name,
  status,
  statusOptions,
  onStatusChange,
  tabs,
  icon,
  children,
}: WorkItemDetailLayoutProps) {
  const t = useTranslations();
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const Icon = icon ? getLucideIcon(icon) : null;

  async function handleStatusChange(newStatus: string) {
    setTransitioning(newStatus);
    try {
      await onStatusChange(newStatus);
    } finally {
      setTransitioning(null);
    }
  }

  async function loadHistory() {
    if (!workItemId || historyEntries.length > 0) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/v1/audit-log?entity_id=${workItemId}&limit=50`,
      );
      if (res.ok) {
        const json = await res.json();
        setHistoryEntries(json.data ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  // All tabs including auto-generated History tab
  const allTabs: Tab[] = [
    ...tabs,
    {
      id: "history",
      label: t("workItems.history"),
      content: (
        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : historyEntries.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {t("workItems.noHistory")}
            </p>
          ) : (
            historyEntries.map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1"
              >
                <div className="flex-1">
                  <span className="font-medium text-gray-900">
                    {entry.userName ?? entry.userEmail ?? "System"}
                  </span>{" "}
                  <span className="text-gray-500">{entry.action}</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500">
        <a href="/work-items" className="hover:text-gray-700">
          {t("workItems.title")}
        </a>
        <ChevronRight size={14} />
        {elementId && (
          <span className="font-mono text-gray-600">{elementId}</span>
        )}
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon size={24} className="text-gray-500" />}
          <div>
            <div className="flex items-center gap-2">
              {elementId && (
                <Badge variant="outline" className="font-mono text-xs">
                  {elementId}
                </Badge>
              )}
              <Badge variant="secondary">{status}</Badge>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{name}</h1>
          </div>
        </div>

        {/* Status transition buttons */}
        {statusOptions.length > 0 && (
          <div className="flex items-center gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={transitioning !== null}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {transitioning === opt.value ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  opt.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={allTabs[0]?.id} className="mt-4">
        <TabsList>
          {allTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => tab.id === "history" && loadHistory()}
            >
              {tab.id === "history" && <History size={14} className="mr-1" />}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {allTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>

      {children}
    </div>
  );
}
