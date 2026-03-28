"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cloud, Loader2, RefreshCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CloudProviderStats {
  provider: string;
  connectorCount: number;
  overallScore: number;
  trend: string;
  criticalFindings: number;
}

interface CloudDashboard {
  providers: CloudProviderStats[];
  totalTests: number;
  passRate: number;
  lastScanDate: string | null;
}

export default function CloudConnectorsPage() {
  const t = useTranslations("connectors");
  const [dashboard, setDashboard] = useState<CloudDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cloud-connectors/dashboard");
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
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  const providerColor: Record<string, string> = {
    aws: "bg-orange-100 text-orange-700 border-orange-200",
    azure: "bg-blue-100 text-blue-700 border-blue-200",
    gcp: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("cloud.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("cloud.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {["aws", "azure", "gcp"].map((provider) => {
              const stats = dashboard.providers.find((p) => p.provider === provider);
              return (
                <div key={provider} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline" className={providerColor[provider]}>
                      {provider.toUpperCase()}
                    </Badge>
                    {stats && <span className="text-2xl font-bold text-gray-900">{stats.overallScore}%</span>}
                  </div>
                  {stats ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">{stats.connectorCount} {t("cloud.connectors")}</p>
                      {stats.criticalFindings > 0 && (
                        <p className="text-sm text-red-600">{stats.criticalFindings} {t("cloud.criticalFindings")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">{t("cloud.notConfigured")}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-600">{t("cloud.totalTests")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dashboard.totalTests}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-600">{t("cloud.passRate")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dashboard.passRate}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
