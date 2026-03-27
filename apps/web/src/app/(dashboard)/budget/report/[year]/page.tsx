"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  FileText,
  Mail,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GrcArea, RoiMethod } from "@grc/shared";

interface ReportData {
  year: number;
  totalBudget: number;
  totalActual: number;
  totalForecast: number;
  delta: number;
  deltaPercent: number;
  topInvestments: Array<{
    entityType: string;
    entityId: string;
    entityTitle: string;
    investmentCost: number;
    roiPercent: number;
    method: RoiMethod;
  }>;
  roniHighlight: {
    totalAle: number;
    topRisks: Array<{ title: string; ale: number }>;
  };
  decisionMatrix: Array<{
    entityTitle: string;
    cost: number;
    expectedBenefit: number;
    roniIfDeferred: number;
  }>;
  costPerEmployee: number;
  costAsRevenuePercent: number;
  previousYear: {
    totalBudget: number;
    totalActual: number;
  } | null;
}

export default function ExecutiveReportPage() {
  const t = useTranslations("budget");
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/budget/report/${year}`);
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

  const handleExportPdf = async () => {
    try {
      const res = await fetch(`/api/v1/budget/report/${year}/export?format=pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `grc-report-${year}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // error handling
    }
  };

  const handleSendEmail = async () => {
    try {
      await fetch(`/api/v1/budget/report/${year}/send`, { method: "POST" });
    } catch {
      // error handling
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{t("report.title")} {year}</h1>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-sm text-gray-400">{t("report.noReportData")}</p>
        </div>
      </div>
    );
  }

  const d = data;
  const budgetChange = d.previousYear
    ? d.totalActual - d.previousYear.totalActual
    : 0;
  const budgetChangePercent = d.previousYear && d.previousYear.totalActual > 0
    ? ((budgetChange / d.previousYear.totalActual) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("report.title")} {year}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t("report.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText size={14} className="mr-1" />
            {t("report.exportPdf")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail}>
            <Mail size={14} className="mr-1" />
            {t("report.sendEmail")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label={t("report.totalBudget")} value={d.totalBudget} currency={t("currency")} />
        <SummaryCard label={t("report.totalActual")} value={d.totalActual} currency={t("currency")} />
        <SummaryCard label={t("report.totalForecast")} value={d.totalForecast} currency={t("currency")} />
        <SummaryCard
          label={t("report.delta")}
          value={d.delta}
          currency={t("currency")}
          highlight={d.delta > 0}
          prefix={d.delta > 0 ? "+" : ""}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">{t("report.costPerEmployee")}</p>
          <p className="text-2xl font-bold text-gray-900">
            {d.costPerEmployee.toLocaleString("de-DE", { minimumFractionDigits: 2 })} {t("currency")}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">{t("report.costAsRevenuePercent")}</p>
          <p className="text-2xl font-bold text-gray-900">
            {d.costAsRevenuePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Top 5 Investments */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("report.topInvestments")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("dashboard.entity")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("roi.investment")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("roi.roiPercent")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("roi.method")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.topInvestments.map((inv, idx) => (
                <tr key={`${inv.entityType}-${inv.entityId}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.entityTitle}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {inv.investmentCost.toLocaleString("de-DE")} {t("currency")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${inv.roiPercent >= 100 ? "text-green-700" : "text-yellow-700"}`}>
                      {inv.roiPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{inv.method}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RONI Highlight */}
      <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-base font-semibold text-red-800">{t("report.roniHighlight")}</h2>
        </div>
        <p className="text-sm text-red-700 mb-4">
          {t("report.roniRecommendation", {
            ale: d.roniHighlight.totalAle.toLocaleString("de-DE"),
          })}
        </p>
        <div className="space-y-2">
          {d.roniHighlight.topRisks.map((risk, idx) => (
            <div key={idx} className="flex justify-between items-center bg-white rounded-lg border border-red-100 px-4 py-2">
              <span className="text-sm text-gray-900">{risk.title}</span>
              <span className="text-sm font-medium text-red-600">
                {risk.ale.toLocaleString("de-DE")} {t("currency")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Matrix */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("report.decisionMatrix")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("dashboard.entity")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("report.cost")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("report.expectedBenefit")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("report.roniIfDeferred")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.decisionMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.entityTitle}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.cost.toLocaleString("de-DE")} {t("currency")}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {row.expectedBenefit.toLocaleString("de-DE")} {t("currency")}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">
                    {row.roniIfDeferred.toLocaleString("de-DE")} {t("currency")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Year-over-Year */}
      {d.previousYear && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("report.yoyComparison")}</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("report.previousYear")}</p>
              <p className="text-xl font-bold text-gray-700">
                {d.previousYear.totalActual.toLocaleString("de-DE")} {t("currency")}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("report.currentYear")}</p>
              <p className="text-xl font-bold text-gray-900">
                {d.totalActual.toLocaleString("de-DE")} {t("currency")}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("report.change")}</p>
              <div className="flex items-center gap-2">
                {budgetChange > 0 ? (
                  <TrendingUp size={16} className="text-red-500" />
                ) : (
                  <TrendingDown size={16} className="text-green-500" />
                )}
                <p className={`text-xl font-bold ${budgetChange > 0 ? "text-red-600" : "text-green-600"}`}>
                  {budgetChange > 0 ? "+" : ""}{budgetChange.toLocaleString("de-DE")} {t("currency")}
                  <span className="text-sm ml-1">({budgetChangePercent.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  currency,
  highlight,
  prefix,
}: {
  label: string;
  value: number;
  currency: string;
  highlight?: boolean;
  prefix?: string;
}) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${highlight ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}>
        {prefix}{value.toLocaleString("de-DE", { minimumFractionDigits: 2 })} {currency}
      </p>
    </div>
  );
}
