"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  BarChart3,
  Target,
  Leaf,
  FileCheck,
  TrendingDown,
  Database,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EsgDashboardData {
  totalMetrics: number;
  activeTargets: number;
  completenessPercent: number;
  openDatapoints: number;
  dataQuality: {
    measured: number;
    estimated: number;
    calculated: number;
  };
  scopeEmissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    totalPreviousYear?: number;
  };
  materialTopics: Array<{
    id: string;
    topicName: string;
    esrsStandard: string;
    impactScore: number;
    financialScore: number;
    isMaterial: boolean;
  }>;
  targets: Array<{
    id: string;
    name: string;
    status: string;
    baselineValue: number;
    targetValue: number;
    currentValue: number;
    progress: number;
  }>;
}

export default function EsgPage() {
  return (
    <ModuleGate moduleKey="esg">
      <EsgDashboardInner />
    </ModuleGate>
  );
}

function EsgDashboardInner() {
  const t = useTranslations("esg");
  const router = useRouter();
  const [data, setData] = useState<EsgDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/esg/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const d = data;
  const totalEmissions =
    (d?.scopeEmissions.scope1 ?? 0) +
    (d?.scopeEmissions.scope2 ?? 0) +
    (d?.scopeEmissions.scope3 ?? 0);
  const emissionDelta = d?.scopeEmissions.totalPreviousYear
    ? totalEmissions - d.scopeEmissions.totalPreviousYear
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dashboard")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Database className="h-5 w-5 text-blue-600" />}
          label={t("totalMetrics")}
          value={String(d?.totalMetrics ?? 0)}
          onClick={() => router.push("/esg/metrics")}
        />
        <KpiCard
          icon={<Target className="h-5 w-5 text-green-600" />}
          label={t("activeTargets")}
          value={String(d?.activeTargets ?? 0)}
          onClick={() => router.push("/esg/targets")}
        />
        <KpiCard
          icon={<FileCheck className="h-5 w-5 text-purple-600" />}
          label={t("completeness")}
          value={`${d?.completenessPercent ?? 0}%`}
          highlight={(d?.completenessPercent ?? 0) < 80}
          onClick={() => router.push("/esg/report/2025")}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
          label={t("openDatapoints")}
          value={String(d?.openDatapoints ?? 0)}
          highlight={(d?.openDatapoints ?? 0) > 20}
          onClick={() => router.push("/esg/datapoints")}
        />
      </div>

      {/* Data Quality Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("metrics.dataQuality")}</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["measured", "estimated", "calculated"] as const).map((q) => {
            const count = d?.dataQuality?.[q] ?? 0;
            const total = (d?.dataQuality?.measured ?? 0) + (d?.dataQuality?.estimated ?? 0) + (d?.dataQuality?.calculated ?? 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={q} className="text-center">
                <QualityBadge quality={q} />
                <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-xs text-gray-500">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope Emissions Summary + Material Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scope Emissions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">{t("scopeEmissions")}</h2>
            <Link href="/esg/emissions" className="text-sm text-blue-600 hover:text-blue-800">
              {t("viewAll")}
            </Link>
          </div>
          <div className="space-y-3">
            <ScopeBar label={t("scopes.scope1")} value={d?.scopeEmissions.scope1 ?? 0} total={totalEmissions} color="bg-red-400" />
            <ScopeBar label={t("scopes.scope2Location")} value={d?.scopeEmissions.scope2 ?? 0} total={totalEmissions} color="bg-orange-400" />
            <ScopeBar label={t("scopes.scope3")} value={d?.scopeEmissions.scope3 ?? 0} total={totalEmissions} color="bg-yellow-400" />
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t("total")}: {totalEmissions.toLocaleString()} {t("co2e")}</span>
            {emissionDelta !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${emissionDelta < 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingDown size={12} className={emissionDelta > 0 ? "rotate-180" : ""} />
                {Math.abs(emissionDelta).toLocaleString()} {t("vsLastYear")}
              </span>
            )}
          </div>
        </div>

        {/* Material Topics */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">{t("materialTopicsOverview")}</h2>
            <Link href="/esg/materiality" className="text-sm text-blue-600 hover:text-blue-800">
              {t("viewAll")}
            </Link>
          </div>
          {!d?.materialTopics?.length ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
          ) : (
            <div className="space-y-2">
              {d.materialTopics.slice(0, 8).map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Leaf size={14} className={topic.isMaterial ? "text-green-600" : "text-gray-400"} />
                    <span className="text-sm font-medium text-gray-900 truncate">{topic.topicName}</span>
                    <Badge variant="outline" className="text-[10px]">{topic.esrsStandard}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0 ml-2">
                    <span>I: {topic.impactScore?.toFixed(1) ?? "-"}</span>
                    <span>F: {topic.financialScore?.toFixed(1) ?? "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Target Progress Cards */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{t("targetProgress")}</h2>
          <Link href="/esg/targets" className="text-sm text-blue-600 hover:text-blue-800">
            {t("viewAll")}
          </Link>
        </div>
        {!d?.targets?.length ? (
          <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {d.targets.slice(0, 6).map((target) => (
              <Link
                key={target.id}
                href="/esg/targets"
                className="rounded-lg border border-gray-100 bg-gray-50 p-4 hover:bg-blue-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 mb-2">{target.name}</p>
                <div className="flex items-center gap-2 mb-2">
                  <TargetStatusBadge status={target.status} t={t} />
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      target.status === "achieved"
                        ? "bg-blue-500"
                        : target.status === "on_track"
                          ? "bg-green-500"
                          : target.status === "at_risk"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, target.progress))}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round(target.progress)}%</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("quickNav")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <NavCard href="/esg/materiality" label={t("materiality.title")} />
          <NavCard href="/esg/datapoints" label={t("datapoints.title")} />
          <NavCard href="/esg/metrics" label={t("metrics.title")} />
          <NavCard href="/esg/emissions" label={t("emissions.title")} />
          <NavCard href="/esg/targets" label={t("targets.title")} />
          <NavCard href="/esg/report/2025" label={t("report.title")} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left hover:shadow-sm transition-shadow w-full ${
        highlight ? "border-red-300 bg-red-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </button>
  );
}

function NavCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
    >
      <p className="text-sm font-medium text-gray-900">{label}</p>
    </Link>
  );
}

function ScopeBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-24 text-right">{value.toLocaleString()} t</span>
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const colors: Record<string, string> = {
    measured: "bg-green-100 text-green-700",
    estimated: "bg-yellow-100 text-yellow-700",
    calculated: "bg-blue-100 text-blue-700",
  };
  return (
    <Badge variant="outline" className={`${colors[quality] ?? ""} text-xs`}>
      {quality}
    </Badge>
  );
}

function TargetStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    on_track: "bg-green-100 text-green-700",
    at_risk: "bg-yellow-100 text-yellow-700",
    off_track: "bg-red-100 text-red-700",
    achieved: "bg-blue-100 text-blue-700",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-[10px]`}>
      {t(`targetStatus.${status}`)}
    </Badge>
  );
}
