"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Layers, Loader2, RefreshCcw, BarChart3, Search, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FrameworkScore {
  framework: string;
  coverage: number;
  gaps: number;
  trend: string;
}

interface FrameworkDashboard {
  overallCoverage: number;
  frameworkCount: number;
  frameworkScores: FrameworkScore[];
  topGaps: Array<{ controlId: string; controlTitle: string; status: string; framework?: string }>;
  lastAnalysisDate: string | null;
}

export default function FrameworkMappingsPage() {
  const t = useTranslations("connectors");
  const [dashboard, setDashboard] = useState<FrameworkDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/framework-mappings/dashboard");
      if (res.ok) {
        const json = await res.json();
        setDashboard(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading && !dashboard) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  const coverageColor = (pct: number) => {
    if (pct >= 80) return "text-green-700 bg-green-100";
    if (pct >= 60) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("frameworks.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("frameworks.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Link href="/connectors/framework-mappings/gap-analysis">
            <Button variant="outline" size="sm"><Search size={14} className="mr-1" />{t("frameworks.runGapAnalysis")}</Button>
          </Link>
          <Link href="/connectors/framework-mappings/heatmap">
            <Button variant="outline" size="sm"><Map size={14} className="mr-1" />{t("frameworks.heatmap")}</Button>
          </Link>
        </div>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("frameworks.overallCoverage")}</p>
              <p className="text-4xl font-bold text-gray-900">{dashboard.overallCoverage}%</p>
              <p className="text-xs text-gray-500 mt-1">{t("frameworks.acrossFrameworks", { count: dashboard.frameworkCount })}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("frameworks.frameworksTracked")}</p>
              <p className="text-4xl font-bold text-gray-900">{dashboard.frameworkCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("frameworks.lastAnalysis")}</p>
              <p className="text-sm text-gray-900 mt-2">
                {dashboard.lastAnalysisDate ? new Date(dashboard.lastAnalysisDate).toLocaleDateString() : t("frameworks.noAnalysis")}
              </p>
            </div>
          </div>

          {/* Framework Score Cards */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{t("frameworks.coverageByFramework")}</h2>
            </div>
            {dashboard.frameworkScores.length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">{t("frameworks.noData")}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {dashboard.frameworkScores.map((fw) => (
                  <div key={fw.framework} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Layers size={16} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{fw.framework}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={`text-[10px] ${coverageColor(fw.coverage)}`}>
                        {fw.coverage}%
                      </Badge>
                      {fw.gaps > 0 && (
                        <span className="text-xs text-red-600">{fw.gaps} {t("frameworks.gaps")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Gaps */}
          {dashboard.topGaps.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">{t("frameworks.topGaps")}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {dashboard.topGaps.map((gap, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-sm text-gray-900">{gap.controlId}</span>
                      {gap.framework && <span className="text-xs text-gray-500 ml-2">({gap.framework})</span>}
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                      {gap.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
