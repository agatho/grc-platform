"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Plus, Award } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsgTarget } from "@grc/shared";

interface TargetRow extends EsgTarget {
  metricName?: string;
  currentValue?: number;
}

export default function TargetsPage() {
  return (
    <ModuleGate moduleKey="esg">
      <TargetsInner />
    </ModuleGate>
  );
}

function TargetsInner() {
  const t = useTranslations("esg");
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/esg/targets");
      if (res.ok) {
        const json = await res.json();
        setTargets(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTargets();
  }, [fetchTargets]);

  if (loading && targets.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("targets.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("targets.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTargets} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={14} className="mr-1" />
            {t("targets.create")}
          </Button>
        </div>
      </div>

      {/* Target Cards */}
      {targets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("empty")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => {
            const baseline = Number(target.baselineValue);
            const targetVal = Number(target.targetValue);
            const current = target.currentValue ?? baseline;
            // Calculate progress: for reduction targets (target < baseline), invert
            const range = Math.abs(baseline - targetVal);
            const achieved = Math.abs(baseline - current);
            const progress = range > 0 ? Math.min(100, Math.max(0, (achieved / range) * 100)) : 0;

            const statusColors: Record<string, string> = {
              on_track: "text-green-600",
              at_risk: "text-yellow-600",
              off_track: "text-red-600",
              achieved: "text-blue-600",
            };

            const progressBarColors: Record<string, string> = {
              on_track: "bg-green-500",
              at_risk: "bg-yellow-500",
              off_track: "bg-red-500",
              achieved: "bg-blue-500",
            };

            return (
              <div
                key={target.id}
                className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug">{target.name}</h3>
                  <TargetStatusBadge status={target.status} t={t} />
                </div>

                {/* Metric name */}
                {target.metricName && (
                  <p className="text-xs text-gray-500 mb-3">{target.metricName}</p>
                )}

                {/* Circular Progress Gauge */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="24" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke={
                          target.status === "achieved"
                            ? "#3b82f6"
                            : target.status === "on_track"
                              ? "#22c55e"
                              : target.status === "at_risk"
                                ? "#eab308"
                                : "#ef4444"
                        }
                        strokeWidth="6"
                        strokeDasharray={`${(progress / 100) * 151} 151`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-bold ${statusColors[target.status] ?? "text-gray-900"}`}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>

                  {/* Baseline -> Current -> Target */}
                  <div className="flex-1 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>{t("targets.baselineValue")}</span>
                      <span className="font-medium text-gray-700">{baseline.toLocaleString()} ({target.baselineYear})</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>{t("targets.currentValue")}</span>
                      <span className="font-medium text-gray-900">{current.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>{t("targets.targetValue")}</span>
                      <span className="font-medium text-gray-700">{targetVal.toLocaleString()} ({target.targetYear})</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarColors[target.status] ?? "bg-gray-400"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Footer badges */}
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px]">
                    {t(`targets.types.${target.targetType}`)}
                  </Badge>
                  {target.sbtiAligned && (
                    <Badge className="bg-blue-100 text-blue-900 text-[10px]">
                      <Award size={10} className="mr-0.5" />
                      SBTi
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TargetStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    on_track: "bg-green-100 text-green-900",
    at_risk: "bg-yellow-100 text-yellow-900",
    off_track: "bg-red-100 text-red-900",
    achieved: "bg-blue-100 text-blue-900",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-[10px]`}>
      {t(`targetStatus.${status}`)}
    </Badge>
  );
}
