"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import type { MaturityGapRow, RadarDataPoint } from "@grc/shared";

interface GapStats {
  avgCurrent: number;
  avgTarget: number;
  avgGap: number;
  totalControls: number;
}

export default function MaturityPage() {
  return (
    <ModuleGate moduleKey="isms">
      <MaturityInner />
    </ModuleGate>
  );
}

function MaturityInner() {
  const t = useTranslations("ismsAssessment");
  const [gaps, setGaps] = useState<MaturityGapRow[]>([]);
  const [stats, setStats] = useState<GapStats | null>(null);
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [activeTab, setActiveTab] = useState<"gap" | "radar">("gap");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gapRes, radarRes] = await Promise.all([
        fetch("/api/v1/isms/maturity/gap-analysis"),
        fetch("/api/v1/isms/maturity/radar"),
      ]);
      if (gapRes.ok) {
        const j = await gapRes.json();
        setGaps(j.data ?? []);
        setStats(j.stats ?? null);
      }
      if (radarRes.ok) {
        const j = await radarRes.json();
        setRadarData(j.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("maturity.title")}</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("gap")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "gap" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("maturity.gapAnalysis")}
        </button>
        <button
          onClick={() => setActiveTab("radar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "radar" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("maturity.radar")}
        </button>
      </div>

      {/* KPI Bar */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{t("maturity.avgCurrent")}</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.avgCurrent}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{t("maturity.avgTarget")}</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{stats.avgTarget}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{t("maturity.avgGap")}</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.avgGap}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{t("maturity.totalControls")}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalControls}</p>
          </div>
        </div>
      )}

      {/* Gap Analysis Tab */}
      {activeTab === "gap" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("maturity.control")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("maturity.department")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("maturity.current")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("maturity.target")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("maturity.gap")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("maturity.severity")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gaps.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t("maturity.noGaps")}</td></tr>
              ) : (
                gaps.map((row) => (
                  <tr key={row.controlId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.controlTitle}</td>
                    <td className="px-4 py-3 text-gray-500">{row.department ?? "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <MaturityBadge level={row.currentMaturity} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MaturityBadge level={row.targetMaturity} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${row.gap >= 3 ? "text-red-600" : row.gap >= 2 ? "text-orange-600" : "text-yellow-600"}`}>
                        {row.gap}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={
                        row.gap >= 3 ? "bg-red-100 text-red-700" :
                        row.gap >= 2 ? "bg-orange-100 text-orange-700" :
                        "bg-yellow-100 text-yellow-700"
                      }>
                        {row.gap >= 3 ? t("maturity.critical") : row.gap >= 2 ? t("maturity.high") : t("maturity.medium")}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Radar Tab */}
      {activeTab === "radar" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {radarData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t("maturity.noData")}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">{t("maturity.radarDescription")}</p>
              {/* Simplified radar as domain bars */}
              <div className="space-y-3 max-w-lg mx-auto">
                {radarData.map((point) => (
                  <div key={point.axis} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="font-medium">{point.axis}</span>
                      <span>{point.current} / {point.target}</span>
                    </div>
                    <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute h-full bg-blue-200 rounded-full"
                        style={{ width: `${(point.target / 5) * 100}%` }}
                      />
                      <div
                        className="absolute h-full bg-blue-500 rounded-full"
                        style={{ width: `${(point.current / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 text-xs text-gray-500 mt-4">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> {t("maturity.current")}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded" /> {t("maturity.target")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span>1 = {t("maturity.level1")}</span>
        <span>2 = {t("maturity.level2")}</span>
        <span>3 = {t("maturity.level3")}</span>
        <span>4 = {t("maturity.level4")}</span>
        <span>5 = {t("maturity.level5")}</span>
      </div>
    </div>
  );
}

function MaturityBadge({ level }: { level: number }) {
  const colors = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-yellow-100 text-yellow-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];
  return (
    <Badge variant="outline" className={colors[level] ?? ""}>
      {level}
    </Badge>
  );
}
