"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
  Loader2,
  RefreshCcw,
  ChevronRight,
  FileWarning,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NIS2Requirement {
  id: string;
  article: string;
  chapter: string;
  nameDE: string;
  nameEN: string;
  status: "compliant" | "partially_compliant" | "non_compliant";
  avgCES: number;
  controlCount: number;
  missingControls: string[];
  evidenceComplete: boolean;
  weight: number;
}

interface NIS2DashboardData {
  requirements: NIS2Requirement[];
  overallScore: number;
  compliantCount: number;
  partiallyCompliantCount: number;
  nonCompliantCount: number;
  totalRequirements: number;
}

export default function NIS2DashboardPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <NIS2DashboardInner />
    </ModuleGate>
  );
}

function NIS2DashboardInner() {
  const t = useTranslations("nis2");
  const router = useRouter();
  const [data, setData] = useState<NIS2DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/nis2/status");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

  const score = data?.overallScore ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/isms/nis2/reporting">
            <Button variant="outline" size="sm">
              <FileWarning size={14} className="mr-1" />
              {t("reportingTracker")}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Score Gauge */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"}
                strokeWidth="12"
                strokeDasharray={`${(score / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{score}%</span>
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 mt-2">{t("overallStatus")}</p>
        </div>

        {/* Compliant */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-xs font-medium text-gray-500">{t("status.compliant")}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data?.compliantCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">/ {data?.totalRequirements ?? 10} {t("requirements")}</p>
        </div>

        {/* Partially Compliant */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <Minus className="h-5 w-5 text-yellow-600" />
            <span className="text-xs font-medium text-gray-500">{t("status.partiallyCompliant")}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data?.partiallyCompliantCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">/ {data?.totalRequirements ?? 10} {t("requirements")}</p>
        </div>

        {/* Non-Compliant */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-xs font-medium text-gray-500">{t("status.nonCompliant")}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data?.nonCompliantCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">/ {data?.totalRequirements ?? 10} {t("requirements")}</p>
        </div>
      </div>

      {/* Requirements Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("requirementsCatalog")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("requirementsDescription")}</p>
        </div>
        <div className="divide-y divide-gray-100">
          {data?.requirements.map((req) => (
            <div
              key={req.id}
              className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => router.push(`/isms/nis2?detail=${req.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={req.status} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{req.article}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {req.nameDE}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        CES: {req.avgCES}%
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {req.controlCount} Controls
                      </Badge>
                      {req.missingControls.length > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                          {req.missingControls.length} {t("missing")}
                        </Badge>
                      )}
                      {req.evidenceComplete && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          {t("evidenceComplete")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NIS2 Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("timeline")}</h2>
        <div className="flex items-center justify-between">
          <TimelineMilestone
            icon={<Shield className="h-5 w-5 text-blue-600" />}
            label={t("milestones.registration")}
            date="17.10.2024"
            status="completed"
          />
          <div className="flex-1 h-px bg-gray-200 mx-3" />
          <TimelineMilestone
            icon={<Clock className="h-5 w-5 text-yellow-600" />}
            label={t("milestones.implementation")}
            date="17.10.2025"
            status="in_progress"
          />
          <div className="flex-1 h-px bg-gray-200 mx-3" />
          <TimelineMilestone
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label={t("milestones.firstNotification")}
            date="17.04.2026"
            status="pending"
          />
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "compliant":
      return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
    case "partially_compliant":
      return <Minus className="h-5 w-5 text-yellow-600 shrink-0" />;
    case "non_compliant":
      return <XCircle className="h-5 w-5 text-red-600 shrink-0" />;
    default:
      return <Minus className="h-5 w-5 text-gray-400 shrink-0" />;
  }
}

function TimelineMilestone({
  icon,
  label,
  date,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
  status: "completed" | "in_progress" | "pending";
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          status === "completed"
            ? "bg-green-100"
            : status === "in_progress"
              ? "bg-yellow-100"
              : "bg-gray-100"
        }`}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700 mt-2">{label}</span>
      <span className="text-[10px] text-gray-400">{date}</span>
    </div>
  );
}
