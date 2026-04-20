"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  AlertTriangle,
  Shield,
  RefreshCcw,
  Link2,
  Link2Off,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VendorRiskRow {
  id: string;
  name: string;
  tier: string;
  inherentRiskScore: number | null;
  residualRiskScore: number | null;
  status: string;
}

interface VendorRiskAggregation {
  vendors: VendorRiskRow[];
  total: number;
  criticalCount: number;
  syncedCount: number;
  unsyncedHighCount: number;
}

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  important: "bg-yellow-100 text-yellow-800 border-yellow-200",
  standard: "bg-gray-100 text-gray-800 border-gray-200",
  low_risk: "bg-green-100 text-green-800 border-green-200",
};

function scoreColor(score: number | null): string {
  if (!score) return "text-gray-400";
  if (score >= 20) return "text-red-700 font-bold";
  if (score >= 15) return "text-red-600";
  if (score >= 10) return "text-yellow-600";
  return "text-green-600";
}

export default function TprmRiskDashboardPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <ModuleTabNav />
      <TprmRiskDashboardInner />
    </ModuleGate>
  );
}

function TprmRiskDashboardInner() {
  const t = useTranslations("tprm");
  const [data, setData] = useState<VendorRiskAggregation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch vendors with risk scores
      const res = await fetch("/api/v1/vendors?limit=100");
      if (!res.ok) return;
      const json = await res.json();
      const vendors: VendorRiskRow[] = json.data ?? [];

      // Fetch ERM sync status via raw aggregation
      let syncedCount = 0;
      let unsyncedHighCount = 0;
      try {
        const syncRes = await fetch("/api/v1/tprm/erm-sync?check=true");
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          syncedCount = syncJson.data?.syncedCount ?? 0;
          unsyncedHighCount = syncJson.data?.unsyncedHighCount ?? 0;
        }
      } catch {
        /* sync status unavailable */
      }

      const criticalCount = vendors.filter(
        (v) => (v.residualRiskScore ?? v.inherentRiskScore ?? 0) >= 15,
      ).length;

      setData({
        vendors,
        total: vendors.length,
        criticalCount,
        syncedCount,
        unsyncedHighCount,
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
          <h1 className="text-2xl font-bold text-gray-900">
            Lieferanten-Risiko&uuml;bersicht
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Aggregierte Risikoansicht aller Drittparteien mit
            ERM-Synchronisation
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Lieferantenrisiken gesamt"
          value={data?.total ?? 0}
          icon={<Shield className="h-5 w-5 text-blue-600" />}
        />
        <KpiCard
          label="Kritisch (Score \u2265 15)"
          value={data?.criticalCount ?? 0}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          variant="danger"
        />
        <KpiCard
          label="Im ERM synchronisiert"
          value={data?.syncedCount ?? 0}
          icon={<Link2 className="h-5 w-5 text-green-600" />}
        />
        <KpiCard
          label="Nicht synchronisiert (hoch)"
          value={data?.unsyncedHighCount ?? 0}
          icon={<Link2Off className="h-5 w-5 text-orange-600" />}
          variant="warning"
        />
      </div>

      {/* Risk Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Lieferanten-Risikobewertungen
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Lieferant
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Tier
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Inherent Score
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Residual Score
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  ERM-Sync
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data?.vendors || data.vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    Keine Lieferantenrisiken vorhanden
                  </td>
                </tr>
              ) : (
                data.vendors.map((v) => {
                  const rScore =
                    v.residualRiskScore ?? v.inherentRiskScore ?? 0;
                  const isCritical = rScore >= 15;
                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-gray-50 transition-colors ${isCritical ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {v.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${TIER_COLORS[v.tier] ?? ""}`}
                        >
                          {v.tier?.replace(/_/g, " ") ?? "-"}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-center ${scoreColor(v.inherentRiskScore)}`}
                      >
                        {v.inherentRiskScore ?? "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-center ${scoreColor(v.residualRiskScore)}`}
                      >
                        {v.residualRiskScore ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {v.status?.replace(/_/g, " ") ?? "-"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCritical ? (
                          <Link2Off
                            size={14}
                            className="inline text-orange-500"
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
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
