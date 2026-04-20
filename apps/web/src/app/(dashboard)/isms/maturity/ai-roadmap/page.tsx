"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Sparkles,
  Info,
  Zap,
  Calendar,
  ListOrdered,
  Target,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MaturityRoadmapAction } from "@grc/shared";

const effortStyles: Record<string, string> = {
  S: "bg-green-100 text-green-900",
  M: "bg-yellow-100 text-yellow-900",
  L: "bg-red-100 text-red-900",
};

const statusStyles: Record<string, string> = {
  proposed: "bg-blue-100 text-blue-900",
  in_progress: "bg-yellow-100 text-yellow-900",
  completed: "bg-green-100 text-green-900",
  dismissed: "bg-gray-100 text-gray-500",
};

const quarterColors: Record<string, string> = {
  Q1: "border-blue-300 bg-blue-50",
  Q2: "border-green-300 bg-green-50",
  Q3: "border-amber-300 bg-amber-50",
  Q4: "border-purple-300 bg-purple-50",
  Unassigned: "border-gray-300 bg-gray-50",
};

interface RoadmapData {
  roadmapRunId: string | null;
  totalActions: number;
  quickWins: number;
  actions: MaturityRoadmapAction[];
  byQuarter?: Record<string, MaturityRoadmapAction[]>;
}

export default function AiRoadmapPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AiRoadmapInner />
    </ModuleGate>
  );
}

function AiRoadmapInner() {
  const t = useTranslations("ismsIntelligence.roadmap");
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
  const [targetMaturity, setTargetMaturity] = useState(3);

  const fetchRoadmap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/maturity/roadmap");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoadmap();
  }, [fetchRoadmap]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/isms/maturity/ai-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMaturity }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        toast.success(
          `${json.data.totalActions} improvement actions generated`,
        );
      } else if (res.status === 429) {
        toast.error(t("rateLimited"));
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (actionId: string, status: string) => {
    const res = await fetch("/api/v1/isms/maturity/roadmap", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, status }),
    });
    if (res.ok) {
      toast.success("Status updated");
      void fetchRoadmap();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const quarters = data?.byQuarter ?? {};
  const quarterOrder = ["Q1", "Q2", "Q3", "Q4", "Unassigned"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">
              {t("targetMaturity")}:
            </label>
            <select
              value={targetMaturity}
              onChange={(e) => setTargetMaturity(Number(e.target.value))}
              className="h-8 rounded-md border border-gray-300 px-2 text-sm"
            >
              {[2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {generating ? t("generating") : t("generateRoadmap")}
          </Button>
        </div>
      </div>

      {/* AI Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">{t("aiNotice")}</p>
      </div>

      {/* KPI Bar */}
      {data && data.totalActions > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {data.totalActions}
            </p>
            <p className="text-xs text-gray-500">{t("totalActions")}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap size={16} className="text-green-600" />
              <p className="text-2xl font-bold text-green-700">
                {data.quickWins}
              </p>
            </div>
            <p className="text-xs text-green-600">{t("quickWins")}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {data.actions.filter((a) => a.status === "completed").length}/
              {data.totalActions}
            </p>
            <p className="text-xs text-gray-500">{t("status.completed")}</p>
          </div>
        </div>
      )}

      {/* View Toggle */}
      {data && data.totalActions > 0 && (
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border ${
              viewMode === "timeline"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            <Calendar size={12} /> {t("timeline")}
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border ${
              viewMode === "list"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            <ListOrdered size={12} /> {t("list")}
          </button>
        </div>
      )}

      {/* No Data */}
      {(!data || data.totalActions === 0) && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Target size={28} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("noResults")}</p>
        </div>
      )}

      {/* Timeline View */}
      {data && data.totalActions > 0 && viewMode === "timeline" && (
        <div className="space-y-6">
          {quarterOrder
            .filter((q) => quarters[q]?.length)
            .map((quarter) => (
              <div key={quarter} className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar size={14} />
                  {t(`quarters.${quarter}`)}
                  <Badge variant="outline" className="ml-1">
                    {quarters[quarter]?.length ?? 0}
                  </Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {quarters[quarter]?.map((action) => (
                    <RoadmapCard
                      key={action.id}
                      action={action}
                      t={t}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* List View */}
      {data && data.totalActions > 0 && viewMode === "list" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-8">
                  #
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">
                  {t("card.domain")}
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">
                  Title
                </th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">
                  {t("card.currentLevel")} / {t("card.targetLevel")}
                </th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">
                  {t("card.effort")}
                </th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">
                  {t("card.quarter")}
                </th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.actions.map((action, idx) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-center text-xs text-gray-400">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs">
                    {action.domain}
                  </td>
                  <td className="px-3 py-3 text-gray-900">
                    <div className="flex items-center gap-2">
                      {action.isQuickWin && (
                        <Zap size={12} className="text-green-500 shrink-0" />
                      )}
                      <span className="truncate max-w-xs">{action.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs">
                      {action.currentLevel}{" "}
                      <ArrowRight size={10} className="inline" />{" "}
                      {action.targetLevel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={effortStyles[action.effort] ?? ""}
                    >
                      {action.effort}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">
                    {action.quarter ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <select
                      value={action.status}
                      onChange={(e) =>
                        handleStatusChange(action.id, e.target.value)
                      }
                      className="text-xs rounded border border-gray-200 px-1 py-0.5"
                    >
                      {[
                        "proposed",
                        "in_progress",
                        "completed",
                        "dismissed",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RoadmapCard({
  action,
  t,
  onStatusChange,
}: {
  action: MaturityRoadmapAction;
  t: ReturnType<typeof useTranslations>;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border-2 p-4 space-y-3 ${
        quarterColors[action.quarter ?? "Unassigned"] ??
        quarterColors.Unassigned
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {action.isQuickWin && (
            <Badge className="bg-green-500 text-white text-[10px]">
              <Zap size={10} className="mr-0.5" /> {t("card.quickWin")}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={effortStyles[action.effort] ?? ""}
          >
            {t(`effort.${action.effort}`)}
          </Badge>
        </div>
        <Badge variant="outline" className={statusStyles[action.status] ?? ""}>
          {t(`status.${action.status}`)}
        </Badge>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900">{action.title}</h4>
        <p className="text-xs text-gray-500 mt-1">{action.domain}</p>
      </div>

      {action.description && (
        <p className="text-xs text-gray-600 line-clamp-3">
          {action.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {t("card.currentLevel")}: {action.currentLevel}{" "}
          <ArrowRight size={10} className="inline" /> {t("card.targetLevel")}:{" "}
          {action.targetLevel}
        </span>
        {action.effortFteMonths && (
          <span>
            {action.effortFteMonths} {t("card.effortFte")}
          </span>
        )}
      </div>

      <div className="pt-2 border-t border-gray-200/50">
        <select
          value={action.status}
          onChange={(e) => onStatusChange(action.id, e.target.value)}
          className="w-full text-xs rounded border border-gray-200 px-2 py-1"
        >
          {["proposed", "in_progress", "completed", "dismissed"].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
