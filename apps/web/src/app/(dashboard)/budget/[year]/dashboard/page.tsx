"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BudgetVsActual, GrcArea } from "@grc/shared";

interface TrafficLightItem {
  grcArea: GrcArea;
  planned: number;
  actual: number;
  percent: number;
}

interface BurnRatePoint {
  month: string;
  budget: number;
  actual: number;
  forecast: number;
}

interface VarianceItem {
  entityType: string;
  entityId: string;
  entityTitle: string;
  grcArea: GrcArea;
  planned: number;
  actual: number;
  variance: number;
}

interface DashboardData {
  trafficLight: TrafficLightItem[];
  burnRate: BurnRatePoint[];
  categoryBreakdown: BudgetVsActual[];
  topVariances: VarianceItem[];
}

export default function BudgetDashboardPage() {
  const t = useTranslations("budget");
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/budget/${year}/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [year]);

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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/budget/${year}`)}
          >
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("dashboard.title")} {year}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("dashboard.subtitle")}
            </p>
          </div>
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

      {/* Traffic Light Overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("dashboard.trafficLight")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {(data?.trafficLight ?? []).map((item) => {
            const color =
              item.percent < 90
                ? "border-green-300 bg-green-50"
                : item.percent <= 100
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-red-300 bg-red-50";
            const textColor =
              item.percent < 90
                ? "text-green-700"
                : item.percent <= 100
                  ? "text-yellow-700"
                  : "text-red-700";
            const statusLabel =
              item.percent < 90
                ? t("dashboard.underBudget")
                : item.percent <= 100
                  ? t("dashboard.onBudget")
                  : t("dashboard.overBudget");
            return (
              <div
                key={item.grcArea}
                className={`rounded-lg border ${color} p-4`}
              >
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {t(`areas.${item.grcArea}`)}
                </p>
                <p className={`text-xl font-bold ${textColor}`}>
                  {item.percent.toFixed(1)}%
                </p>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>
                    {t("dashboard.budget")}:{" "}
                    {item.planned.toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {t("dashboard.actual")}:{" "}
                    {item.actual.toLocaleString("de-DE")}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`${textColor} text-[10px] mt-2`}
                >
                  {statusLabel}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Burn Rate + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burn Rate Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {t("dashboard.burnRate")}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {t("dashboard.burnRateSubtitle")}
          </p>
          {(data?.burnRate ?? []).length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              {t("dashboard.noVariances")}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.burnRate ?? []).map((point) => {
                const maxVal = Math.max(
                  point.budget,
                  point.actual,
                  point.forecast,
                  1,
                );
                return (
                  <div key={point.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-12 shrink-0">
                      {point.month}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-blue-200 rounded-full flex-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{
                              width: `${(point.budget / maxVal) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-16 text-right">
                          {point.budget.toLocaleString("de-DE")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-green-200 rounded-full flex-1 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${(point.actual / maxVal) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-16 text-right">
                          {point.actual.toLocaleString("de-DE")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-orange-200 rounded-full flex-1 overflow-hidden border border-dashed border-orange-300">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{
                              width: `${(point.forecast / maxVal) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-16 text-right">
                          {point.forecast.toLocaleString("de-DE")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
                <LegendDot color="bg-blue-500" label={t("dashboard.budget")} />
                <LegendDot color="bg-green-500" label={t("dashboard.actual")} />
                <LegendDot
                  color="bg-orange-400"
                  label={t("dashboard.forecast")}
                />
              </div>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {t("dashboard.categoryBreakdown")}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {t("dashboard.categoryBreakdownSubtitle")}
          </p>
          <div className="space-y-3">
            {(data?.categoryBreakdown ?? []).map((item) => {
              const total = item.planned || 1;
              const pct = Math.round((item.actual / total) * 100);
              return (
                <div
                  key={`${item.grcArea}-${item.costCategory}`}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-gray-600 w-32 shrink-0 truncate">
                    {t(`areas.${item.grcArea}`)}
                  </span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct > 100 ? "bg-red-400" : pct > 90 ? "bg-yellow-400" : "bg-green-400"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-12 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Variances */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {t("dashboard.topVariances")}
          </h2>
          <p className="text-xs text-gray-500">
            {t("dashboard.topVariancesSubtitle")}
          </p>
        </div>
        {(data?.topVariances ?? []).length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            {t("dashboard.noVariances")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    {t("dashboard.entity")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    {t("matrix.area")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    {t("dashboard.budget")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    {t("dashboard.actual")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    {t("dashboard.variance")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.topVariances ?? []).map((v, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {v.variance > 0 ? (
                          <TrendingUp size={14} className="text-red-500" />
                        ) : (
                          <TrendingDown size={14} className="text-green-500" />
                        )}
                        <span className="font-medium text-gray-900">
                          {v.entityTitle}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {v.entityType}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t(`areas.${v.grcArea}`)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {v.planned.toLocaleString("de-DE")}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {v.actual.toLocaleString("de-DE")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${v.variance > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {v.variance > 0 ? "+" : ""}
                        {v.variance.toLocaleString("de-DE")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
