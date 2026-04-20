"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Building2,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  RefreshCcw,
  ArrowRight,
  Link2,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VendorDashboard {
  totalVendors: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  lksgRelevantCount: number;
  overdueAssessments: Array<{
    id: string;
    name: string;
    tier: string;
    nextAssessmentDate: string;
  }>;
  pendingDueDiligence: Array<{
    id: string;
    vendorId: string;
    status: string;
    sentAt: string;
  }>;
}

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  important: "bg-yellow-100 text-yellow-800 border-yellow-200",
  standard: "bg-gray-100 text-gray-800 border-gray-200",
  low_risk: "bg-green-100 text-green-800 border-green-200",
};

export default function TprmDashboardPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <ModuleTabNav />
      <TprmDashboardInner />
    </ModuleGate>
  );
}

function TprmDashboardInner() {
  const t = useTranslations("tprm");
  const router = useRouter();
  const [data, setData] = useState<VendorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleErmSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/v1/tprm/erm-sync", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        const count = json.data?.syncedCount ?? 0;
        setSyncResult(
          count > 0
            ? `${count} Risiken ins ERM synchronisiert`
            : "Keine neuen Risiken zu synchronisieren",
        );
      } else {
        const err = await res.json().catch(() => null);
        setSyncResult(err?.error ?? "Synchronisation fehlgeschlagen");
      }
    } catch {
      setSyncResult("Synchronisation fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/vendors/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      /* ignore */
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleErmSync}
            disabled={syncing}
          >
            <Link2 size={14} className={syncing ? "animate-spin" : ""} />
            Ins ERM synchronisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/tprm/vendors")}>
            <Building2 size={16} />
            {t("viewVendors")}
          </Button>
        </div>
      </div>

      {/* ERM Sync Result Banner */}
      {syncResult && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-blue-600" />
            <span className="text-sm text-blue-800">{syncResult}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncResult(null)}
            className="text-blue-400 hover:text-blue-600 text-xs"
          >
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label={t("kpi.totalVendors")}
          value={data?.totalVendors ?? 0}
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
        />
        <KpiCard
          label={t("kpi.critical")}
          value={data?.byTier?.critical ?? 0}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          variant="danger"
        />
        <KpiCard
          label={t("kpi.assessmentDue")}
          value={data?.overdueAssessments?.length ?? 0}
          icon={<ClipboardCheck className="h-5 w-5 text-yellow-600" />}
          variant="warning"
        />
        <KpiCard
          label={t("kpi.lksgRelevant")}
          value={data?.lksgRelevantCount ?? 0}
          icon={<Shield className="h-5 w-5 text-indigo-600" />}
        />
      </div>

      {/* Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("tierDistribution")}
          </h2>
          <div className="space-y-3">
            {["critical", "important", "standard", "low_risk"].map((tier) => {
              const val = data?.byTier?.[tier] ?? 0;
              const total = data?.totalVendors || 1;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={tier} className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`${TIER_COLORS[tier]} w-24 justify-center`}
                  >
                    {t(`tier.${tier}`)}
                  </Badge>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 rounded-full bg-gray-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* DD Queue */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t("ddQueue")}
            </h2>
            <span className="text-xs text-gray-400">
              {data?.pendingDueDiligence?.length ?? 0} {t("pending")}
            </span>
          </div>
          {!data?.pendingDueDiligence ||
          data.pendingDueDiligence.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noPendingDD")}</p>
          ) : (
            <div className="space-y-2">
              {data.pendingDueDiligence.slice(0, 5).map((dd) => (
                <div
                  key={dd.id}
                  className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">
                    {dd.vendorId.slice(0, 8)}...
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {dd.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overdue Assessments */}
      {data?.overdueAssessments && data.overdueAssessments.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-base font-semibold text-yellow-800 mb-3">
            {t("overdueAssessments")}
          </h2>
          <div className="space-y-2">
            {data.overdueAssessments.map((v) => (
              <Link
                key={v.id}
                href={`/tprm/vendors/${v.id}`}
                className="flex items-center justify-between rounded border border-yellow-200 bg-white px-4 py-2 hover:bg-yellow-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={TIER_COLORS[v.tier] ?? ""}
                  >
                    {t(`tier.${v.tier}`)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">
                    {v.nextAssessmentDate}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: "danger" | "warning";
}) {
  const borderClass =
    variant === "danger"
      ? "border-red-200"
      : variant === "warning"
        ? "border-yellow-200"
        : "border-gray-200";

  return (
    <div className={`rounded-lg border ${borderClass} bg-white p-4`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
