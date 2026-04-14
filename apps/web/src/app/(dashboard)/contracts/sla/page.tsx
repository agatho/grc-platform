"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  BarChart3,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SlaWithMeasurement {
  slaId: string;
  contractId: string;
  contractTitle: string;
  metricName: string;
  targetValue: string;
  unit: string;
  measurementFrequency: string;
  latestActual?: string;
  latestBreach?: boolean;
  latestPeriodEnd?: string;
}

export default function SlaMonitoringPage() {
  return (
    <ModuleGate moduleKey="contract">
      <ModuleTabNav />
      <SlaMonitoringInner />
    </ModuleGate>
  );
}

function SlaMonitoringInner() {
  const t = useTranslations("contracts");
  const [slaData, setSlaData] = useState<SlaWithMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSlaData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch active contracts
      const cRes = await fetch("/api/v1/contracts?limit=200&status=active,renewal");
      if (!cRes.ok) return;
      const cJson = await cRes.json();
      const contracts = cJson.data ?? [];

      const allSlas: SlaWithMeasurement[] = [];
      for (const c of contracts) {
        try {
          const sRes = await fetch(`/api/v1/contracts/${c.id}/sla`);
          if (!sRes.ok) continue;
          const sJson = await sRes.json();
          for (const sla of sJson.data ?? []) {
            // Fetch latest measurement
            let latestActual: string | undefined;
            let latestBreach: boolean | undefined;
            let latestPeriodEnd: string | undefined;
            try {
              const mRes = await fetch(`/api/v1/contracts/${c.id}/sla/${sla.id}/measurements?limit=1`);
              if (mRes.ok) {
                const mJson = await mRes.json();
                const latest = mJson.data?.[0];
                if (latest) {
                  latestActual = latest.actualValue;
                  latestBreach = latest.isBreach;
                  latestPeriodEnd = latest.periodEnd;
                }
              }
            } catch {
              /* ignore */
            }

            allSlas.push({
              slaId: sla.id,
              contractId: c.id,
              contractTitle: c.title,
              metricName: sla.metricName,
              targetValue: sla.targetValue,
              unit: sla.unit,
              measurementFrequency: sla.measurementFrequency,
              latestActual,
              latestBreach,
              latestPeriodEnd,
            });
          }
        } catch {
          /* ignore */
        }
      }

      setSlaData(allSlas);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSlaData();
  }, [fetchSlaData]);

  const breachCount = slaData.filter((s) => s.latestBreach).length;
  const okCount = slaData.filter((s) => s.latestBreach === false).length;

  if (loading && slaData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("slaMonitoring")}</h1>
          <p className="text-sm text-gray-500 mt-1">{slaData.length} SLA {t("metrics")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSlaData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{slaData.length}</p>
          <p className="text-xs text-gray-500">{t("sla.totalMetrics")}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <p className="text-2xl font-bold text-green-700">{okCount}</p>
          </div>
          <p className="text-xs text-gray-500">{t("sla.metOk")}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="text-2xl font-bold text-red-700">{breachCount}</p>
          </div>
          <p className="text-xs text-gray-500">{t("sla.breaches")}</p>
        </div>
      </div>

      {/* SLA List */}
      {slaData.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <BarChart3 size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("sla.none")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slaData.map((s) => (
            <Link
              key={s.slaId}
              href={`/contracts/${s.contractId}`}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 bg-white hover:border-blue-300 transition-colors ${s.latestBreach ? "border-red-200" : "border-gray-200"}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.metricName}</p>
                <p className="text-xs text-gray-500 truncate">{s.contractTitle}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <span className="text-xs text-gray-500">
                  {t("sla.target")}: {s.targetValue}{s.unit}
                </span>
                {s.latestActual != null && (
                  <span className={`text-xs font-medium ${s.latestBreach ? "text-red-600" : "text-green-600"}`}>
                    {t("sla.actual")}: {s.latestActual}{s.unit}
                  </span>
                )}
                {s.latestBreach === true && (
                  <Badge variant="outline" className="bg-red-100 text-red-900 border-red-200 text-xs">
                    {t("sla.breach")}
                  </Badge>
                )}
                {s.latestBreach === false && (
                  <Badge variant="outline" className="bg-green-100 text-green-900 border-green-200 text-xs">
                    {t("sla.ok")}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">{s.measurementFrequency}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
