"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowLeft,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NIS2Report {
  id: string;
  incidentId: string;
  reportType: string;
  status: string;
  deadlineAt: string;
  submittedAt: string | null;
  bsiReference: string | null;
  contactPerson: string | null;
  createdAt: string;
  incidentTitle: string;
  incidentElementId: string;
  incidentSeverity: string;
  incidentStatus: string;
  incidentDetectedAt: string;
}

interface ReportStats {
  total: number;
  overdue: number;
  pending: number;
  submitted: number;
}

export default function NIS2ReportingPage() {
  return (
    <ModuleGate moduleKey="isms">
      <NIS2ReportingInner />
    </ModuleGate>
  );
}

function NIS2ReportingInner() {
  const t = useTranslations("nis2");
  const [reports, setReports] = useState<NIS2Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/nis2/reporting-tracker");
      if (res.ok) {
        const json = await res.json();
        setReports(json.data);
        setStats(json.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/isms/nis2">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("reporting.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("reporting.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500">{t("reporting.total")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-gray-500">{t("reporting.overdue")}</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats?.overdue ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-gray-500">{t("reporting.pending")}</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500">{t("reporting.submitted")}</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.submitted ?? 0}</p>
        </div>
      </div>

      {/* NIS2 Notification Stepper Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">{t("reporting.art23Title")}</h3>
        <div className="flex items-center gap-6 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-200 text-red-800 flex items-center justify-center font-bold text-[10px]">1</div>
            <span>{t("reporting.earlyWarning")} (24h)</span>
          </div>
          <div className="h-px w-6 bg-blue-300" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-yellow-200 text-yellow-800 flex items-center justify-center font-bold text-[10px]">2</div>
            <span>{t("reporting.fullNotification")} (72h)</span>
          </div>
          <div className="h-px w-6 bg-blue-300" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center font-bold text-[10px]">3</div>
            <span>{t("reporting.finalReport")} (1 {t("reporting.month")})</span>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("reporting.reports")}</h2>
        </div>
        {reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {t("reporting.noReports")}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => {
              const isOverdue = report.status === "draft" && new Date(report.deadlineAt) < now;
              return (
                <div key={report.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">
                            {report.incidentElementId}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {report.incidentTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <ReportTypeBadge type={report.reportType} />
                          <ReportStatusBadge status={report.status} isOverdue={isOverdue} />
                          <span className="text-xs text-gray-500">
                            {t("reporting.deadline")}: {new Date(report.deadlineAt).toLocaleDateString("de-DE")}
                          </span>
                          {report.bsiReference && (
                            <span className="text-xs text-gray-400">
                              BSI: {report.bsiReference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    early_warning: "bg-red-100 text-red-700 border-red-200",
    full_notification: "bg-yellow-100 text-yellow-700 border-yellow-200",
    intermediate_report: "bg-blue-100 text-blue-700 border-blue-200",
    final_report: "bg-green-100 text-green-700 border-green-200",
  };
  const labels: Record<string, string> = {
    early_warning: "Fruehwarnung",
    full_notification: "Vollmeldung",
    intermediate_report: "Zwischenbericht",
    final_report: "Abschlussbericht",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[type] ?? ""}`}>
      {labels[type] ?? type}
    </Badge>
  );
}

function ReportStatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  if (isOverdue) {
    return (
      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
        Ueberfaellig
      </Badge>
    );
  }
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-100 text-blue-700",
    acknowledged: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
