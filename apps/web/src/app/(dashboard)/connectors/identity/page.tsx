"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  Loader2,
  RefreshCcw,
  Users,
  Key,
  UserX,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface IdentityDashboard {
  totalUsers: number;
  mfaComplianceRate: number;
  staleAccounts: number;
  privilegedAccounts: number;
  pendingAccessReviews: number;
  saasComplianceRate: number;
}

export default function IdentityConnectorsPage() {
  const t = useTranslations("connectors");
  const [dashboard, setDashboard] = useState<IdentityDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/identity-connectors/dashboard");
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
            {t("identity.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("identity.subtitle")}</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            icon={<Users className="h-5 w-5 text-blue-600" />}
            label={t("identity.totalUsers")}
            value={String(dashboard.totalUsers)}
          />
          <KpiCard
            icon={<Key className="h-5 w-5 text-green-600" />}
            label={t("identity.mfaCompliance")}
            value={`${dashboard.mfaComplianceRate}%`}
          />
          <KpiCard
            icon={<UserX className="h-5 w-5 text-orange-600" />}
            label={t("identity.staleAccounts")}
            value={String(dashboard.staleAccounts)}
          />
          <KpiCard
            icon={<Shield className="h-5 w-5 text-red-600" />}
            label={t("identity.privilegedAccounts")}
            value={String(dashboard.privilegedAccounts)}
          />
          <KpiCard
            icon={<Eye className="h-5 w-5 text-purple-600" />}
            label={t("identity.pendingReviews")}
            value={String(dashboard.pendingAccessReviews)}
          />
          <KpiCard
            icon={<Shield className="h-5 w-5 text-indigo-600" />}
            label={t("identity.saasCompliance")}
            value={`${dashboard.saasComplianceRate}%`}
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
