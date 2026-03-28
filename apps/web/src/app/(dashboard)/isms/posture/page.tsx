"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Users,
  Building2,
  Cpu,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PostureFactors {
  assetCoverage: number;
  maturity: number;
  ces: number;
  vulnExposure: number;
  incidentTTR: number;
  freshness: number;
  soaCompleteness: number;
}

interface DomainScores {
  organizational: number;
  people: number;
  physical: number;
  technological: number;
}

interface TrendPoint {
  date: string;
  value: number;
}

export default function SecurityPosturePage() {
  return (
    <ModuleGate moduleKey="isms">
      <PostureInner />
    </ModuleGate>
  );
}

function PostureInner() {
  const t = useTranslations("boardKpi");
  const [overallScore, setOverallScore] = useState(0);
  const [factors, setFactors] = useState<PostureFactors | null>(null);
  const [trend, setTrend] = useState<string>("stable");
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [domains, setDomains] = useState<DomainScores | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [hasEnoughTrendData, setHasEnoughTrendData] = useState(false);
  const [quarterlyDelta, setQuarterlyDelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postureRes, domainRes, trendRes] = await Promise.all([
        fetch("/api/v1/isms/posture"),
        fetch("/api/v1/isms/posture/domains"),
        fetch("/api/v1/isms/posture/trend"),
      ]);

      if (postureRes.ok) {
        const json = await postureRes.json();
        setOverallScore(json.overallScore ?? 0);
        setFactors(json.factors ?? null);
        setTrend(json.trend ?? "stable");
        setPreviousScore(json.previousScore ?? null);
      }
      if (domainRes.ok) {
        const json = await domainRes.json();
        setDomains(json.domains ?? null);
      }
      if (trendRes.ok) {
        const json = await trendRes.json();
        setTrendData(json.data ?? []);
        setHasEnoughTrendData(json.hasEnoughData ?? false);
        setQuarterlyDelta(json.quarterlyDelta ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !factors) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const getTrendIcon = () => {
    if (trend === "improving") return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (trend === "declining") return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-gray-400" />;
  };

  const factorConfig: Record<string, { label: string; weight: string }> = {
    assetCoverage: { label: t("posture.factors.assetCoverage"), weight: "15%" },
    maturity: { label: t("posture.factors.maturity"), weight: "20%" },
    ces: { label: t("posture.factors.ces"), weight: "20%" },
    vulnExposure: { label: t("posture.factors.vulnExposure"), weight: "15%" },
    incidentTTR: { label: t("posture.factors.incidentTTR"), weight: "10%" },
    freshness: { label: t("posture.factors.freshness"), weight: "10%" },
    soaCompleteness: { label: t("posture.factors.soaCompleteness"), weight: "10%" },
  };

  const domainConfig: Record<string, { icon: typeof Shield; label: string }> = {
    organizational: { icon: Shield, label: t("posture.domains.organizational") },
    people: { icon: Users, label: t("posture.domains.people") },
    physical: { icon: Building2, label: t("posture.domains.physical") },
    technological: { icon: Cpu, label: t("posture.domains.technological") },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("posture.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("posture.subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Gauge + Trend */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 flex flex-col items-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={overallScore >= 75 ? "#22c55e" : overallScore >= 50 ? "#eab308" : "#ef4444"}
              strokeWidth="12"
              strokeDasharray={`${(overallScore / 100) * 327} 327`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900">{overallScore}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {getTrendIcon()}
          <span className="text-sm text-gray-600">
            {trend === "improving"
              ? t("posture.trendImproving")
              : trend === "declining"
                ? t("posture.trendDeclining")
                : t("posture.trendStable")}
          </span>
          {quarterlyDelta !== null && (
            <Badge
              variant="outline"
              className={`${
                quarterlyDelta > 0
                  ? "bg-green-50 text-green-700 border-green-200"
                  : quarterlyDelta < 0
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              {quarterlyDelta > 0 ? "+" : ""}
              {quarterlyDelta} {t("posture.vsQuarter")}
            </Badge>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      {factors && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("posture.factorBreakdown")}
          </h2>
          <div className="space-y-3">
            {Object.entries(factors).map(([key, value]) => {
              const config = factorConfig[key];
              if (!config) return null;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {config.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {t("posture.weight")}: {config.weight}
                      </span>
                      <span className="font-mono text-gray-600 w-12 text-right">
                        {Math.round(value)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
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
              );
            })}
          </div>
        </div>
      )}

      {/* Domain View */}
      {domains && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(domains) as [string, number][]).map(([domain, score]) => {
            const config = domainConfig[domain];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div
                key={domain}
                className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col items-center"
              >
                <Icon
                  className={`h-8 w-8 mb-2 ${
                    score >= 80
                      ? "text-green-600"
                      : score >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                />
                <span className="text-2xl font-bold text-gray-900">{score}%</span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend Data */}
      {!hasEnoughTrendData && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">{t("posture.noTrendData")}</p>
        </div>
      )}
    </div>
  );
}
