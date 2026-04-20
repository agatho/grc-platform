"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Check,
  X,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SoaAiSuggestion } from "@grc/shared";

const gapTypeStyles: Record<string, string> = {
  not_covered: "bg-red-100 text-red-900",
  partial: "bg-yellow-100 text-yellow-900",
  full: "bg-green-100 text-green-900",
};

const priorityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-gray-100 text-gray-600",
};

const statusStyles: Record<string, string> = {
  pending: "bg-blue-100 text-blue-900",
  accepted: "bg-green-100 text-green-900",
  rejected: "bg-gray-100 text-gray-500",
};

interface GapAnalysisData {
  analysisRunId: string | null;
  totalSuggestions: number;
  gapsByType: { not_covered: number; partial: number; full: number };
  suggestions: SoaAiSuggestion[];
}

export default function SoaAiGapAnalysisPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AiGapAnalysisInner />
    </ModuleGate>
  );
}

function AiGapAnalysisInner() {
  const t = useTranslations("ismsIntelligence.soaGap");
  const [data, setData] = useState<GapAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/soa/ai-gap-analysis");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/v1/isms/soa/ai-gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework: "iso27001" }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        toast.success(`${json.data.totalSuggestions} gaps identified`);
      } else if (res.status === 429) {
        toast.error(t("rateLimited"));
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Analysis failed");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReview = async (id: string, status: "accepted" | "rejected") => {
    const res = await fetch(`/api/v1/isms/soa/ai-gap-analysis/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(
        status === "accepted" ? "Suggestion accepted" : "Suggestion rejected",
      );
      void fetchResults();
    }
  };

  const filteredSuggestions =
    data?.suggestions?.filter((s) => {
      if (filter === "all") return true;
      if (filter === "gaps") return s.gapType !== "full";
      if (filter === "highConfidence") return s.confidence > 80;
      if (filter === "pending") return s.status === "pending";
      return true;
    }) ?? [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button
          onClick={handleStartAnalysis}
          disabled={analyzing}
          className="gap-2"
        >
          {analyzing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {analyzing ? t("analyzing") : t("startAnalysis")}
        </Button>
      </div>

      {/* AI Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">{t("aiNotice")}</p>
      </div>

      {/* Summary Cards */}
      {data && data.totalSuggestions > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {data.totalSuggestions}
            </p>
            <p className="text-xs text-gray-500">{t("summary.totalGaps")}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">
              {data.gapsByType.not_covered}
            </p>
            <p className="text-xs text-red-600">{t("summary.notCovered")}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {data.gapsByType.partial}
            </p>
            <p className="text-xs text-yellow-600">{t("summary.partial")}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {data.gapsByType.full}
            </p>
            <p className="text-xs text-green-600">{t("summary.full")}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1">
        {["all", "gaps", "highConfidence", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === f
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>

      {/* Suggestions Table */}
      {!data || data.totalSuggestions === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Sparkles size={28} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("noResults")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t("table.controlRef")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t("table.controlTitle")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  {t("table.gapType")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  {t("table.confidence")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  {t("table.priority")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  {t("table.status")}
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuggestions.map((s) => (
                <>
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === s.id ? null : s.id)
                    }
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {s.frameworkControlRef}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="flex items-center gap-1">
                        {s.frameworkControlTitle ?? "-"}
                        {expandedId === s.id ? (
                          <ChevronUp size={14} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={gapTypeStyles[s.gapType] ?? ""}
                      >
                        {t(`gapType.${s.gapType}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-bold ${
                          s.confidence >= 80
                            ? "text-green-600"
                            : s.confidence >= 50
                              ? "text-yellow-600"
                              : "text-gray-400"
                        }`}
                      >
                        {s.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={priorityStyles[s.priority] ?? ""}
                      >
                        {t(`priority.${s.priority}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={statusStyles[s.status] ?? ""}
                      >
                        {t(`status.${s.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(s.id, "accepted");
                            }}
                            title={t("actions.accept")}
                          >
                            <Check size={14} className="text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(s.id, "rejected");
                            }}
                            title={t("actions.reject")}
                          >
                            <X size={14} className="text-red-600" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50">
                        <div className="text-sm text-gray-700">
                          <span className="font-medium text-gray-500">
                            {t("table.reasoning")}:{" "}
                          </span>
                          {s.reasoning ?? "-"}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
