"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Shield,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LksgDashboard {
  totalVendors: number;
  lksgRelevant: number;
  lksgVendors: Array<{
    id: string;
    name: string;
    country?: string;
    lksgTier?: string;
    tier: string;
  }>;
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function LksgPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <LksgPageInner />
    </ModuleGate>
  );
}

function LksgPageInner() {
  const t = useTranslations("tprm");
  const [data, setData] = useState<LksgDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/lksg");
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
          <h1 className="text-2xl font-bold text-gray-900">{t("lksg.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("lksg.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{data?.lksgRelevant ?? 0}</p>
          <p className="text-xs text-gray-500">{t("lksg.relevantVendors")}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t("lksg.ofTotal", { total: data?.totalVendors ?? 0 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{data?.byStatus?.completed ?? 0}</p>
          <p className="text-xs text-gray-500">{t("lksg.completedAssessments")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <p className="text-2xl font-bold text-gray-900">
              {(data?.byRiskLevel?.high ?? 0) + (data?.byRiskLevel?.critical ?? 0)}
            </p>
          </div>
          <p className="text-xs text-gray-500">{t("lksg.highRisk")}</p>
        </div>
      </div>

      {/* Risk Level Distribution */}
      {data?.byRiskLevel && Object.keys(data.byRiskLevel).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("lksg.riskDistribution")}</h2>
          <div className="flex items-center gap-4">
            {["low", "medium", "high", "critical"].map((level) => {
              const val = data.byRiskLevel[level] ?? 0;
              return (
                <div key={level} className="flex items-center gap-2">
                  <Badge variant="outline" className={RISK_COLORS[level] ?? ""}>
                    {t(`lksg.risk.${level}`)}
                  </Badge>
                  <span className="text-sm font-medium">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendor List */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("lksg.vendorList")}</h2>
        {(!data?.lksgVendors || data.lksgVendors.length === 0) ? (
          <p className="text-sm text-gray-400">{t("lksg.noVendors")}</p>
        ) : (
          <div className="space-y-2">
            {data.lksgVendors.map((v) => (
              <Link
                key={v.id}
                href={`/tprm/vendors/${v.id}`}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{v.name}</span>
                  <span className="text-xs text-gray-500">{v.country ?? ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  {v.lksgTier && (
                    <Badge variant="outline" className="text-xs">{v.lksgTier}</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
