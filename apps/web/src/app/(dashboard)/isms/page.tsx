"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Bug,
  Zap,
  Loader2,
  RefreshCcw,
  ClipboardCheck,
  BarChart3,
  FileCheck,
  CalendarCheck,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ProtectionLevelBadge } from "@/components/isms/protection-level-badge";
import { IncidentSeverityBadge } from "@/components/isms/incident-severity-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IncidentSeverity, AssessmentStatus } from "@grc/shared";

interface DashboardData {
  assets: {
    total: number;
    classified: number;
    unclassified: number;
    byProtection: Record<string, number>;
  };
  incidents: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{
      id: string;
      elementId: string;
      title: string;
      severity: IncidentSeverity;
      status: string;
      detectedAt: string;
      isDataBreach: boolean;
      dataBreachDeadline?: string;
    }>;
  };
  threats: { total: number };
  vulnerabilities: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

interface AssessmentSummary {
  id: string;
  name: string;
  status: AssessmentStatus;
  completionPercentage: number;
  completedEvaluations: number;
  totalEvaluations: number;
  periodStart?: string;
  periodEnd?: string;
}

interface SoaStats {
  total: number;
  implemented: number;
  implementationPercentage: number;
  notImplemented: number;
}

interface MaturityStats {
  avgCurrent: number;
  avgTarget: number;
  totalControls: number;
}

interface ReviewSummary {
  id: string;
  title: string;
  status: string;
  reviewDate: string;
  nextReviewDate?: string;
}

export default function IsmsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IsmsDashboardInner />
    </ModuleGate>
  );
}

function IsmsDashboardInner() {
  const t = useTranslations("isms");
  const ta = useTranslations("ismsAssessment");
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentSummary | null>(null);
  const [soaStats, setSoaStats] = useState<SoaStats | null>(null);
  const [maturityStats, setMaturityStats] = useState<MaturityStats | null>(null);
  const [latestReview, setLatestReview] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, assessRes, soaRes, matRes, revRes] = await Promise.all([
        fetch("/api/v1/isms/dashboard"),
        fetch("/api/v1/isms/assessments?limit=1"),
        fetch("/api/v1/isms/soa?limit=1"),
        fetch("/api/v1/isms/maturity/gap-analysis"),
        fetch("/api/v1/isms/reviews?limit=1"),
      ]);

      if (dashRes.ok) {
        const json = await dashRes.json();
        setData(json.data);
      }
      if (assessRes.ok) {
        const json = await assessRes.json();
        if (json.data?.length > 0) setLatestAssessment(json.data[0]);
      }
      if (soaRes.ok) {
        const json = await soaRes.json();
        if (json.stats) setSoaStats(json.stats);
      }
      if (matRes.ok) {
        const json = await matRes.json();
        if (json.stats) setMaturityStats(json.stats);
      }
      if (revRes.ok) {
        const json = await revRes.json();
        if (json.data?.length > 0) setLatestReview(json.data[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const d = data;

  // Compute compliance score from incidents, SoA, maturity
  const complianceScore = soaStats?.implementationPercentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{ta("complianceScore.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("title")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Top Row: Compliance Gauge + KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Compliance Score Gauge */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={complianceScore >= 75 ? "#22c55e" : complianceScore >= 50 ? "#eab308" : "#ef4444"}
                strokeWidth="12"
                strokeDasharray={`${(complianceScore / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{complianceScore}%</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mt-3">{ta("complianceScore.label")}</p>
        </div>

        {/* KPI Cards */}
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            icon={<FileCheck className="h-5 w-5 text-blue-600" />}
            label={ta("soa.implementationPct")}
            value={`${soaStats?.implementationPercentage ?? 0}%`}
            subtitle={`${soaStats?.total ?? 0} ${ta("soa.controls")}`}
            onClick={() => router.push("/isms/soa")}
          />
          <KpiCard
            icon={<BarChart3 className="h-5 w-5 text-purple-600" />}
            label={ta("maturity.avgCurrent")}
            value={`${maturityStats?.avgCurrent ?? 0}/5`}
            subtitle={ta("maturity.title")}
            onClick={() => router.push("/isms/maturity")}
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label={t("openIncidents")}
            value={String(d?.incidents.open ?? 0)}
            subtitle={`${d?.incidents.total ?? 0} ${t("total")}`}
            onClick={() => router.push("/isms/incidents")}
          />
          <KpiCard
            icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
            label={ta("assessment.progress")}
            value={`${latestAssessment?.completionPercentage ?? 0}%`}
            subtitle={ta("assessment.title")}
            onClick={() => router.push("/isms/assessments")}
          />
          <KpiCard
            icon={<Bug className="h-5 w-5 text-orange-600" />}
            label={t("criticalVulnerabilities")}
            value={String((d?.vulnerabilities.bySeverity?.critical ?? 0) + (d?.vulnerabilities.bySeverity?.high ?? 0))}
            subtitle={`${d?.vulnerabilities.total ?? 0} ${t("total")}`}
            onClick={() => router.push("/isms/vulnerabilities")}
          />
          <KpiCard
            icon={<CalendarCheck className="h-5 w-5 text-teal-600" />}
            label={ta("review.title")}
            value={latestReview ? ta(`review.statuses.${latestReview.status}`) : "-"}
            subtitle={latestReview?.reviewDate ?? ta("review.noneYet")}
            onClick={() => router.push("/isms/reviews")}
          />
        </div>
      </div>

      {/* Latest Assessment Card */}
      {latestAssessment && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{ta("assessment.latest")}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{latestAssessment.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                <AssessmentStatusBadge status={latestAssessment.status} />
                <span className="ml-2">
                  {latestAssessment.completedEvaluations}/{latestAssessment.totalEvaluations} {ta("evaluation.evaluated")}
                </span>
              </p>
            </div>
            <Link href={`/isms/assessments/${latestAssessment.id}`}>
              <Button variant="outline" size="sm">{ta("assessment.continue")}</Button>
            </Link>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${latestAssessment.completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Classification Distribution + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("classificationDistribution")}
          </h2>
          <div className="space-y-3">
            {(["normal", "high", "very_high"] as const).map((level) => {
              const count = d?.assets.byProtection[level] ?? 0;
              const total = d?.assets.classified ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <ProtectionLevelBadge level={level} className="w-24 justify-center" />
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        level === "normal"
                          ? "bg-green-400"
                          : level === "high"
                            ? "bg-orange-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-16 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("quickStats")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/isms/threats" className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-600">{t("threats")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{d?.threats.total ?? 0}</p>
            </Link>
            <Link href="/isms/vulnerabilities" className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Bug className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-600">{t("vulnerabilities")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{d?.vulnerabilities.total ?? 0}</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Management Review Card */}
      {latestReview && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{ta("review.title")}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {ta("review.last")}: {latestReview.reviewDate}
                {latestReview.nextReviewDate && (
                  <span className="ml-3">{ta("review.nextReview")}: {latestReview.nextReviewDate}</span>
                )}
              </p>
            </div>
            <Link href="/isms/reviews">
              <Button variant="outline" size="sm">{ta("review.create")}</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Recent Incidents */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{t("recentIncidents")}</h2>
          <Link href="/isms/incidents" className="text-sm text-blue-600 hover:text-blue-800">
            {t("viewAll")}
          </Link>
        </div>
        {!d?.incidents.recent?.length ? (
          <p className="text-sm text-gray-400 py-8 text-center">{t("noIncidents")}</p>
        ) : (
          <div className="space-y-2">
            {d.incidents.recent.slice(0, 5).map((inc) => (
              <Link
                key={inc.id}
                href={`/isms/incidents/${inc.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-400 shrink-0">
                    {inc.elementId}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {inc.title}
                  </span>
                  {inc.isDataBreach && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                      {t("breach72h")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <IncidentSeverityBadge severity={inc.severity} />
                  <Badge variant="outline" className="text-[10px]">
                    {t(`incidentStatus.${inc.status}`)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const colors: Record<string, string> = {
    planning: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    review: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-[10px]`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:shadow-sm transition-shadow w-full"
    >
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-gray-600">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </button>
  );
}
