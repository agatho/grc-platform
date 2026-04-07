"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RefreshCcw, ArrowLeft, Download, CheckCircle, FileText, Send } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsgAnnualReport } from "@grc/shared";

interface CompletenessItem {
  standard: string;
  totalDatapoints: number;
  coveredDatapoints: number;
  percentage: number;
}

interface GapItem {
  datapointCode: string;
  datapointName: string;
  standard: string;
  issue: string;
}

export default function ReportYearPage() {
  return (
    <ModuleGate moduleKey="esg">
      <ReportYearInner />
    </ModuleGate>
  );
}

function ReportYearInner() {
  const t = useTranslations("esg");
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  const [report, setReport] = useState<EsgAnnualReport | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessItem[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes, gRes] = await Promise.all([
        fetch(`/api/v1/esg/reports/${year}`),
        fetch(`/api/v1/esg/reports/${year}/completeness`),
        fetch(`/api/v1/esg/reports/${year}/gaps`),
      ]);
      if (rRes.ok) {
        const json = await rRes.json();
        setReport(json.data);
      }
      if (cRes.ok) {
        const json = await cRes.json();
        setCompleteness(json.data ?? []);
      }
      if (gRes.ok) {
        const json = await gRes.json();
        setGaps(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleWorkflow = async (action: string) => {
    try {
      await fetch(`/api/v1/esg/reports/${year}/${action}`, { method: "POST" });
      await fetchData();
    } catch {
      // error handling
    }
  };

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/api/v1/esg/reports/${year}/export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `esrs-report-${year}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // error handling
    }
  };

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const overallPct = report?.completenessPercent ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/esg")}>
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
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
            <Download size={14} className="mr-1" />
            {t("report.exportJson")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <FileText size={14} className="mr-1" />
            {t("report.exportPdf")}
          </Button>
        </div>
      </div>

      {/* Report Status + Overall Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-lg border border-gray-200 bg-white p-6 flex flex-col items-center justify-center">
          {/* Completeness Gauge */}
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={overallPct >= 80 ? "#22c55e" : overallPct >= 50 ? "#eab308" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray={`${(overallPct / 100) * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{overallPct}%</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mt-3">{t("completeness")}</p>
        </div>

        {/* Approval Workflow */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("report.approval")}</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-600">{t("status")}:</span>
            <ReportStatusBadge status={report?.status ?? "draft"} t={t} />
          </div>

          {/* Workflow steps visualization */}
          <div className="flex items-center gap-2 mb-4">
            {(["draft", "in_review", "approved", "published"] as const).map((step, idx) => {
              const isActive = report?.status === step;
              const isPast =
                (["draft", "in_review", "approved", "published"] as const).indexOf(report?.status ?? "draft") > idx;
              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      isPast
                        ? "bg-green-100 text-green-900"
                        : isActive
                          ? "bg-blue-100 text-blue-900 ring-2 ring-blue-300"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isPast ? <CheckCircle size={14} /> : idx + 1}
                  </div>
                  {idx < 3 && (
                    <div className={`w-8 h-0.5 ${isPast ? "bg-green-300" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Workflow Actions */}
          <div className="flex gap-2">
            {report?.status === "draft" && (
              <Button size="sm" onClick={() => handleWorkflow("submit")}>
                <Send size={14} className="mr-1" />
                {t("report.submitForReview")}
              </Button>
            )}
            {report?.status === "in_review" && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleWorkflow("approve")}>
                  <CheckCircle size={14} className="mr-1" />
                  {t("report.approve")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleWorkflow("revert")}>
                  {t("report.revertToDraft")}
                </Button>
              </>
            )}
            {report?.status === "approved" && (
              <Button size="sm" onClick={() => handleWorkflow("publish")}>
                {t("report.publish")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Completeness Overview per Standard */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("report.completenessOverview")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("report.standard")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("report.covered")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("report.totalDr")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-48">{t("report.percentage")}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {completeness.map((item) => {
                const color =
                  item.percentage >= 80 ? "bg-green-500" : item.percentage >= 50 ? "bg-yellow-500" : "bg-red-500";
                const statusColor =
                  item.percentage >= 80 ? "bg-green-100 text-green-900" : item.percentage >= 50 ? "bg-yellow-100 text-yellow-900" : "bg-red-100 text-red-900";
                return (
                  <tr key={item.standard} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.standard}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.coveredDatapoints}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.totalDatapoints}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${item.percentage}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">{item.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={`${statusColor} text-[10px]`}>
                        {item.percentage >= 80 ? "OK" : item.percentage >= 50 ? "Partial" : "Gap"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {completeness.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t("noData")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gap List */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("report.gapList")}</h2>
        </div>
        {gaps.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">{t("noData")}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {gaps.map((gap, idx) => (
              <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-500 shrink-0">{gap.datapointCode}</span>
                  <span className="text-sm text-gray-900 truncate">{gap.datapointName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-[10px]">{gap.standard}</Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-600 text-[10px]">
                    {t("report.datapointMissing")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_review: "bg-yellow-100 text-yellow-900",
    approved: "bg-green-100 text-green-900",
    published: "bg-blue-100 text-blue-900",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-xs`}>
      {t(`report.status.${status}`)}
    </Badge>
  );
}
