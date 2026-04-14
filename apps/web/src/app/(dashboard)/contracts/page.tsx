"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  FileText,
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCcw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ContractDashboard {
  totalContracts: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  portfolioAnnualValue: string;
  upcomingExpirations: Array<{
    id: string;
    title: string;
    expirationDate: string;
    autoRenewal: boolean;
  }>;
  overdueObligations: Array<{
    id: string;
    contractId: string;
    title: string;
    dueDate: string;
    status: string;
  }>;
  recentBreaches: Array<{
    id: string;
    slaId: string;
    metricName: string;
    actualValue: string;
    periodEnd: string;
  }>;
}

export default function ContractsDashboardPage() {
  return (
    <ModuleGate moduleKey="contract">
      <ModuleTabNav />
      <ContractsDashboardInner />
    </ModuleGate>
  );
}

function ContractsDashboardInner() {
  const t = useTranslations("contracts");
  const router = useRouter();
  const [data, setData] = useState<ContractDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/contracts/dashboard");
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

  const formatCurrency = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "\u2014";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/contracts/list")}>
            <FileText size={16} />
            {t("viewContracts")}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label={t("kpi.activeContracts")}
          value={String(data?.byStatus?.active ?? 0)}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <KpiCard
          label={t("kpi.portfolioValue")}
          value={formatCurrency(data?.portfolioAnnualValue ?? "0")}
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
        />
        <KpiCard
          label={t("kpi.expiringSoon")}
          value={String(data?.upcomingExpirations?.length ?? 0)}
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          variant="warning"
        />
        <KpiCard
          label={t("kpi.overdueObligations")}
          value={String(data?.overdueObligations?.length ?? 0)}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Expirations */}
        <div className="rounded-lg border border-yellow-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("expiringContracts")}</h2>
          {(!data?.upcomingExpirations || data.upcomingExpirations.length === 0) ? (
            <p className="text-sm text-gray-400">{t("noExpiring")}</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingExpirations.map((c) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{c.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-yellow-700">{c.expirationDate}</span>
                    {c.autoRenewal && (
                      <Badge variant="outline" className="text-xs">{t("autoRenewal")}</Badge>
                    )}
                    <ArrowRight size={14} className="text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Obligations */}
        <div className="rounded-lg border border-red-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("overdueObligations")}</h2>
          {(!data?.overdueObligations || data.overdueObligations.length === 0) ? (
            <p className="text-sm text-gray-400">{t("noOverdue")}</p>
          ) : (
            <div className="space-y-2">
              {data.overdueObligations.map((o) => (
                <Link
                  key={o.id}
                  href={`/contracts/${o.contractId}`}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{o.title}</span>
                  <span className="text-xs text-red-600">{o.dueDate}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SLA Breaches */}
      {data?.recentBreaches && data.recentBreaches.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-semibold text-red-800 mb-3">{t("slaBreaches")}</h2>
          <div className="space-y-2">
            {data.recentBreaches.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded border border-red-200 bg-white px-4 py-2"
              >
                <span className="text-sm font-medium text-gray-900">{b.metricName}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-red-600">{t("sla.actual")}: {b.actualValue}</span>
                  <span className="text-gray-500">{b.periodEnd}</span>
                </div>
              </div>
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
  value: string;
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
