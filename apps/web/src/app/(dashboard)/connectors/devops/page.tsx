"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  GitBranch,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Code,
  AlertTriangle,
  Monitor,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DevopsDashboard {
  repositoriesMonitored: number;
  branchProtectionRate: number;
  codeReviewCoverage: number;
  secretScanningEnabled: number;
  endpointComplianceRate: number;
  firewallRuleCompliance: number;
  criticalFindings: number;
}

export default function DevopsConnectorsPage() {
  const t = useTranslations("connectors");
  const [dashboard, setDashboard] = useState<DevopsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/devops-connectors/dashboard");
      if (res.ok) {
        const json = await res.json();
        setDashboard(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !dashboard) {
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
          <h1 className="text-2xl font-bold text-gray-900">
            {t("devops.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("devops.subtitle")}</p>
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

      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<GitBranch className="h-5 w-5 text-blue-600" />}
            label={t("devops.repos")}
            value={String(dashboard.repositoriesMonitored)}
          />
          <KpiCard
            icon={<ShieldCheck className="h-5 w-5 text-green-600" />}
            label={t("devops.branchProtection")}
            value={`${dashboard.branchProtectionRate}%`}
          />
          <KpiCard
            icon={<Code className="h-5 w-5 text-purple-600" />}
            label={t("devops.codeReview")}
            value={`${dashboard.codeReviewCoverage}%`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label={t("devops.criticalFindings")}
            value={String(dashboard.criticalFindings)}
          />
          <KpiCard
            icon={<Monitor className="h-5 w-5 text-orange-600" />}
            label={t("devops.endpointCompliance")}
            value={`${dashboard.endpointComplianceRate}%`}
          />
          <KpiCard
            icon={<Network className="h-5 w-5 text-indigo-600" />}
            label={t("devops.firewallCompliance")}
            value={`${dashboard.firewallRuleCompliance}%`}
          />
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
