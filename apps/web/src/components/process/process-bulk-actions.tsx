"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X, ChevronDown, Loader2, Download, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProcessStatus } from "@grc/shared";

interface ProcessBulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function ProcessBulkActions({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: ProcessBulkActionsProps) {
  const t = useTranslations("processGovernance");
  const tProcess = useTranslations("process");
  const [loading, setLoading] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  const STATUSES: ProcessStatus[] = [
    "draft",
    "in_review",
    "approved",
    "published",
    "archived",
  ];

  const handleBulkStatus = async (status: ProcessStatus) => {
    setShowStatusMenu(false);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/processes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_status",
          processIds: selectedIds,
          payload: { status },
        }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      const json = await res.json();
      const succeeded = json.data?.succeeded ?? 0;
      const failed = json.data?.failed ?? 0;
      if (failed > 0) {
        toast.warning(t("bulk.partial", { succeeded, failed }));
      } else {
        toast.success(t("bulk.success", { count: succeeded }));
      }
      onActionComplete();
      onClearSelection();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/processes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export",
          processIds: selectedIds,
          payload: { format },
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processes-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("bulk.success", { count }));
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky bottom-4 z-30 mx-auto max-w-3xl">
      <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-lg">
        {loading && (
          <Loader2 size={16} className="animate-spin text-indigo-600" />
        )}

        <span className="text-sm font-medium text-indigo-900">
          {t("bulk.selected", { count })}
        </span>

        <div className="flex-1" />

        {/* Change Status */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            disabled={loading}
          >
            <ChevronDown size={14} />
            {t("bulk.changeStatus")}
          </Button>
          {showStatusMenu && (
            <div className="absolute bottom-full mb-1 right-0 z-40 rounded-md border border-gray-200 bg-white shadow-lg py-1 min-w-[160px]">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
                  onClick={() => handleBulkStatus(s)}
                >
                  {tProcess(`status.${s}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={loading}
        >
          <Download size={14} />
          {t("bulk.export")}
        </Button>

        {/* Clear */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={loading}
        >
          <X size={14} />
          {t("bulk.clearSelection")}
        </Button>
      </div>
    </div>
  );
}
