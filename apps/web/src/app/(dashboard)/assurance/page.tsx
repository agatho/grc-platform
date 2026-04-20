"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Lightbulb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ModuleScore {
  module: string;
  score: number;
  factors: {
    evidenceAge: number;
    testCoverage: number;
    dataQuality: number;
    assessmentSource: number;
    automationLevel: number;
  };
  recommendations: Array<{ action: string; impactPercent: number }>;
  trend?: "improving" | "stable" | "declining";
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendData {
  module: string;
  trend: TrendPoint[];
}

export default function AssuranceDashboardPage() {
  const t = useTranslations("boardKpi");
  const router = useRouter();
  const [modules, setModules] = useState<ModuleScore[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [selectedModule, setSelectedModule] = useState<ModuleScore | null>(
    null,
  );
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [hasEnoughTrendData, setHasEnoughTrendData] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoresRes, trendRes] = await Promise.all([
        fetch("/api/v1/assurance/scores"),
        fetch("/api/v1/assurance/trend"),
      ]);

      if (scoresRes.ok) {
        const json = await scoresRes.json();
        setModules(json.modules ?? []);
        setOverallScore(json.overallScore ?? 0);
      }
      if (trendRes.ok) {
        const json = await trendRes.json();
        setTrendData(json.data ?? []);
        setHasEnoughTrendData(json.hasEnoughData ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && modules.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100 border-green-200";
    if (score >= 50) return "bg-yellow-100 border-yellow-200";
    return "bg-red-100 border-red-200";
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === "improving")
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "declining")
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const factorLabels: Record<string, string> = {
    evidenceAge: t("assurance.factors.evidenceAge"),
    testCoverage: t("assurance.factors.testCoverage"),
    dataQuality: t("assurance.factors.dataQuality"),
    assessmentSource: t("assurance.factors.assessmentSource"),
    automationLevel: t("assurance.factors.automationLevel"),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("assurance.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("assurance.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Overall Score */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-28 h-28 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={
                  overallScore >= 80
                    ? "#22c55e"
                    : overallScore >= 50
                      ? "#eab308"
                      : "#ef4444"
                }
                strokeWidth="12"
                strokeDasharray={`${(overallScore / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">
                {overallScore}
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mt-3">
            {t("assurance.overallScore")}
          </p>
        </div>
      </div>

      {/* Module Cards (Traffic Light) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map((mod) => (
          <button
            key={mod.module}
            type="button"
            onClick={() =>
              setSelectedModule(
                selectedModule?.module === mod.module ? null : mod,
              )
            }
            className={`rounded-lg border p-4 text-left transition-all hover:shadow-sm ${
              selectedModule?.module === mod.module
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-gray-200"
            } bg-white`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 uppercase">
                {mod.module}
              </span>
              {getTrendIcon(mod.trend)}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${getScoreColor(mod.score)}`}
              >
                {mod.score}
              </span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  mod.score >= 80
                    ? "bg-green-400"
                    : mod.score >= 50
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
                style={{ width: `${mod.score}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Drill-down Panel */}
      {selectedModule && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {selectedModule.module.toUpperCase()} — {t("assurance.drilldown")}
            </h2>
            <Badge
              variant="outline"
              className={`${getScoreBg(selectedModule.score)} text-sm`}
            >
              {selectedModule.score}/100
            </Badge>
          </div>

          {/* Factor Bars */}
          <div className="space-y-3">
            {Object.entries(selectedModule.factors).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {factorLabels[key] ?? key}
                  </span>
                  <span className="font-mono text-gray-600">
                    {Math.round(value)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      value >= 80
                        ? "bg-green-400"
                        : value >= 50
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {selectedModule.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                {t("assurance.recommendations")}
              </h3>
              {selectedModule.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <span className="text-sm text-gray-700">{rec.action}</span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    +{rec.impactPercent}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trend Notice */}
      {!hasEnoughTrendData && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">{t("assurance.noTrendData")}</p>
        </div>
      )}

      {modules.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">{t("assurance.noModules")}</p>
        </div>
      )}
    </div>
  );
}
