"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  TrendingUp,
  Clock,
  CheckCircle2,
  Shield,
  BarChart3,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import type { WbStatistics } from "@grc/shared";

export default function WbStatisticsPage() {
  return (
    <ModuleGate moduleKey="whistleblowing">
      <StatisticsInner />
    </ModuleGate>
  );
}

const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  fraud: { de: "Betrug", en: "Fraud" },
  corruption: { de: "Korruption", en: "Corruption" },
  discrimination: { de: "Diskriminierung", en: "Discrimination" },
  privacy: { de: "Datenschutz", en: "Privacy" },
  environmental: { de: "Umwelt", en: "Environmental" },
  health_safety: { de: "Arbeitsschutz", en: "Health & Safety" },
  other: { de: "Sonstiges", en: "Other" },
};

const RESOLUTION_LABELS: Record<string, { de: string; en: string }> = {
  substantiated: { de: "Begruendet", en: "Substantiated" },
  unsubstantiated: { de: "Unbegruendet", en: "Unsubstantiated" },
  inconclusive: { de: "Unklar", en: "Inconclusive" },
  referred: { de: "Weitergeleitet", en: "Referred" },
};

function StatisticsInner() {
  const t = useTranslations("whistleblowing");
  const [data, setData] = useState<WbStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/whistleblowing/statistics");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">{t("noStatistics")}</p>
      </div>
    );
  }

  const categoryTotal = Object.values(data.byCategory).reduce((a, b) => a + b, 0) || 1;
  const resolutionTotal = Object.values(data.byResolution).reduce((a, b) => a + b, 0) || 1;
  const maxMonthCount = Math.max(...(data.byMonth.map((m) => m.count) || [0]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("statisticsTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("statisticsSubtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          {t("refresh")}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          label={t("totalYtd")}
          value={data.totalYtd}
          subtext={`${t("previousYear")}: ${data.totalPreviousYear}`}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label={t("avgResolution")}
          value={`${data.avgResolutionDays}d`}
          subtext={t("avgResolutionDays")}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          label={t("sla7dCompliance")}
          value={`${data.sla7dCompliance}%`}
          subtext={t("sla7dLabel")}
          highlight={data.sla7dCompliance >= 90}
        />
        <KpiCard
          icon={<Shield className="h-5 w-5 text-green-500" />}
          label={t("sla3mCompliance")}
          value={`${data.sla3mCompliance}%`}
          subtext={t("sla3mLabel")}
          highlight={data.sla3mCompliance >= 90}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t("categoryDistribution")}</h3>
          <div className="space-y-3">
            {Object.entries(data.byCategory).map(([cat, cnt]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 truncate">
                  {CATEGORY_LABELS[cat]?.de ?? cat}
                </span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(cnt / categoryTotal) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t("monthlyTrend")}</h3>
          <div className="flex items-end gap-2 h-40">
            {data.byMonth.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${(m.count / maxMonthCount) * 100}%`, minHeight: m.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[10px] text-gray-400 mt-1">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t("resolutionBreakdown")}</h3>
          <div className="space-y-3">
            {Object.entries(data.byResolution).map(([res, cnt]) => (
              <div key={res} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 truncate">
                  {RESOLUTION_LABELS[res]?.de ?? res}
                </span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${(cnt / resolutionTotal) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">{t("statusDistribution")}</h3>
          <div className="space-y-3">
            {Object.entries(data.byStatus).map(([status, cnt]) => {
              const colors: Record<string, string> = {
                received: "bg-gray-400",
                acknowledged: "bg-blue-500",
                investigating: "bg-yellow-500",
                resolved: "bg-green-500",
                closed: "bg-gray-600",
              };
              const totalStatus = Object.values(data.byStatus).reduce((a, b) => a + b, 0) || 1;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 truncate">
                    {t(`status.${status}`)}
                  </span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors[status] ?? "bg-gray-400"}`}
                      style={{ width: `${(cnt / totalStatus) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtext,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${highlight ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  );
}
