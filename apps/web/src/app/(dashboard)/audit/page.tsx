"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  List,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AuditDashboard {
  totalAudits: number;
  plannedAudits: number;
  inProgressAudits: number;
  completedAudits: number;
  overdueAudits: number;
  universe: {
    total: number;
    neverAudited: number;
    overdue: number;
    coveragePercent: number;
  };
  findingsBySeverity: Record<string, number>;
}

export default function AuditPage() {
  return (
    <ModuleGate moduleKey="audit">
      <AuditDashboardInner />
    </ModuleGate>
  );
}

function AuditDashboardInner() {
  const t = useTranslations("auditMgmt");
  const router = useRouter();
  const [data, setData] = useState<AuditDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audit-mgmt/dashboard");
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
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dashboard")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Overdue Banner */}
      {(d?.overdueAudits ?? 0) > 0 && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="font-semibold text-orange-800">
              {d!.overdueAudits} {t("overdueAudits")}
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Calendar className="h-5 w-5 text-blue-600" />}
          label={t("planned")}
          value={String(d?.plannedAudits ?? 0)}
          onClick={() => router.push("/audit/executions?status=planned")}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          label={t("inProgress")}
          value={String(d?.inProgressAudits ?? 0)}
          onClick={() => router.push("/audit/executions?status=in_progress")}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          label={t("completed")}
          value={String(d?.completedAudits ?? 0)}
          onClick={() => router.push("/audit/executions?status=completed")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("overdue")}
          value={String(d?.overdueAudits ?? 0)}
          highlight={(d?.overdueAudits ?? 0) > 0}
        />
      </div>

      {/* KPI Cards Row 2: Universe Coverage + Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Universe Coverage */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">{t("universeCoverage")}</h2>
          </div>
          <div className="flex items-end gap-4 mb-4">
            <span className="text-4xl font-bold text-gray-900">
              {d?.universe.coveragePercent ?? 0}%
            </span>
            <span className="text-sm text-gray-500 mb-1">
              {(d?.universe.total ?? 0) - (d?.universe.neverAudited ?? 0)} / {d?.universe.total ?? 0} {t("entitiesAudited")}
            </span>
          </div>
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 rounded-full h-2 transition-all"
                style={{ width: `${d?.universe.coveragePercent ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              {(d?.universe.neverAudited ?? 0) > 0 && (
                <span className="text-red-600">
                  {d!.universe.neverAudited} {t("neverAudited")}
                </span>
              )}
              {(d?.universe.overdue ?? 0) > 0 && (
                <span className="text-orange-600">
                  {d!.universe.overdue} {t("overdueEntities")}
                </span>
              )}
            </div>
          </div>
          <Link
            href="/audit/universe"
            className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            {t("viewUniverse")}
          </Link>
        </div>

        {/* Findings Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">{t("findingsBreakdown")}</h2>
          </div>
          <div className="space-y-2">
            <SeverityRow label={t("severity.significantNonconformity")} count={d?.findingsBySeverity?.significant_nonconformity ?? 0} color="bg-red-500" />
            <SeverityRow label={t("severity.insignificantNonconformity")} count={d?.findingsBySeverity?.insignificant_nonconformity ?? 0} color="bg-orange-500" />
            <SeverityRow label={t("severity.improvementRequirement")} count={d?.findingsBySeverity?.improvement_requirement ?? 0} color="bg-yellow-500" />
            <SeverityRow label={t("severity.recommendation")} count={d?.findingsBySeverity?.recommendation ?? 0} color="bg-blue-400" />
            <SeverityRow label={t("severity.observation")} count={d?.findingsBySeverity?.observation ?? 0} color="bg-gray-400" />
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("quickNav")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <NavCard href="/audit/universe" label={t("universe")} icon={<Globe className="h-4 w-4" />} />
          <NavCard href="/audit/plans" label={t("plans")} icon={<Calendar className="h-4 w-4" />} />
          <NavCard href="/audit/executions" label={t("executions")} icon={<ClipboardCheck className="h-4 w-4" />} />
          <NavCard href="/audit/executions" label={t("findings")} icon={<List className="h-4 w-4" />} />
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
      <p className={`text-2xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </button>
  );
}

function NavCard({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center gap-3"
    >
      {icon}
      <p className="text-sm font-medium text-gray-900">{label}</p>
    </Link>
  );
}

function SeverityRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className="font-medium text-gray-900">{count}</span>
    </div>
  );
}
