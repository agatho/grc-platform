"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Bug,
  Zap,
  Loader2,
  RefreshCcw,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ProtectionLevelBadge } from "@/components/isms/protection-level-badge";
import { IncidentSeverityBadge } from "@/components/isms/incident-severity-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IncidentSeverity } from "@grc/shared";

interface DashboardData {
  assets: {
    total: number;
    classified: number;
    unclassified: number;
    byProtection: Record<string, number>;
  };
  incidents: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{
      id: string;
      elementId: string;
      title: string;
      severity: IncidentSeverity;
      status: string;
      detectedAt: string;
      isDataBreach: boolean;
      dataBreachDeadline?: string;
    }>;
  };
  threats: { total: number };
  vulnerabilities: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

export default function IsmsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IsmsDashboardInner />
    </ModuleGate>
  );
}

function IsmsDashboardInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/dashboard");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("title")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Shield className="h-5 w-5 text-green-600" />}
          label={t("classifiedAssets")}
          value={d?.assets.classified ?? 0}
          subtitle={`${d?.assets.total ?? 0} ${t("total")}`}
          onClick={() => router.push("/isms/assets")}
        />
        <KpiCard
          icon={<Shield className="h-5 w-5 text-gray-400" />}
          label={t("unclassifiedAssets")}
          value={d?.assets.unclassified ?? 0}
          subtitle={t("needsClassification")}
          onClick={() => router.push("/isms/assets")}
          highlight={d?.assets.unclassified ? "warning" : undefined}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("openIncidents")}
          value={d?.incidents.open ?? 0}
          subtitle={`${d?.incidents.total ?? 0} ${t("total")}`}
          onClick={() => router.push("/isms/incidents")}
          highlight={d?.incidents.open ? "danger" : undefined}
        />
        <KpiCard
          icon={<Bug className="h-5 w-5 text-orange-600" />}
          label={t("criticalVulnerabilities")}
          value={(d?.vulnerabilities.bySeverity?.critical ?? 0) + (d?.vulnerabilities.bySeverity?.high ?? 0)}
          subtitle={`${d?.vulnerabilities.total ?? 0} ${t("total")}`}
          onClick={() => router.push("/isms/vulnerabilities")}
        />
      </div>

      {/* Classification Distribution + Threats/Vulns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification Distribution */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("classificationDistribution")}
          </h2>
          <div className="space-y-3">
            {(["normal", "high", "very_high"] as const).map((level) => {
              const count = d?.assets.byProtection[level] ?? 0;
              const total = d?.assets.classified ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <ProtectionLevelBadge level={level} className="w-24 justify-center" />
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        level === "normal"
                          ? "bg-green-400"
                          : level === "high"
                            ? "bg-orange-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-16 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("quickStats")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/isms/threats" className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-600">{t("threats")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{d?.threats.total ?? 0}</p>
            </Link>
            <Link href="/isms/vulnerabilities" className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Bug className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-600">{t("vulnerabilities")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{d?.vulnerabilities.total ?? 0}</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{t("recentIncidents")}</h2>
          <Link href="/isms/incidents" className="text-sm text-blue-600 hover:text-blue-800">
            {t("viewAll")}
          </Link>
        </div>
        {!d?.incidents.recent?.length ? (
          <p className="text-sm text-gray-400 py-8 text-center">{t("noIncidents")}</p>
        ) : (
          <div className="space-y-2">
            {d.incidents.recent.map((inc) => (
              <Link
                key={inc.id}
                href={`/isms/incidents/${inc.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-400 shrink-0">
                    {inc.elementId}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {inc.title}
                  </span>
                  {inc.isDataBreach && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                      {t("breach72h")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <IncidentSeverityBadge severity={inc.severity} />
                  <Badge variant="outline" className="text-[10px]">
                    {t(`incidentStatus.${inc.status}`)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  onClick?: () => void;
  highlight?: "warning" | "danger";
}) {
  const border =
    highlight === "danger"
      ? "border-red-200"
      : highlight === "warning"
        ? "border-yellow-200"
        : "border-gray-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border ${border} bg-white p-5 text-left hover:shadow-sm transition-shadow w-full`}
    >
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-sm font-medium text-gray-600">{label}</span></div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </button>
  );
}
