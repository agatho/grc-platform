"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReadinessCheck {
  id: string;
  labelDE: string;
  labelEN: string;
  category: string;
  passed: boolean;
  details?: string;
}

interface ReadinessData {
  score: number;
  checks: ReadinessCheck[];
  passedCount: number;
  totalChecks: number;
}

interface TimelineData {
  openGaps: number;
  closedLastMonth: number;
  estimatedWeeks: number | null;
  estimatedDate: string | null;
}

interface PriorityItem {
  rank: number;
  catalogCode: string;
  catalogTitle: string;
  implementation: string;
  reason: string;
  estimatedEffort: string;
}

const CERTIFICATIONS = [
  { id: "iso27001", name: "ISO 27001", icon: "shield" },
  { id: "soc2", name: "SOC 2", icon: "award" },
  { id: "tisax", name: "TISAX", icon: "car" },
  { id: "c5", name: "BSI C5", icon: "cloud" },
  { id: "iso22301", name: "ISO 22301", icon: "refresh" },
  { id: "iso27701", name: "ISO 27701", icon: "lock" },
];

export default function CertificationsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <CertificationsInner />
    </ModuleGate>
  );
}

function CertificationsInner() {
  const t = useTranslations("certifications");
  const router = useRouter();
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [readinessRes, timelineRes] = await Promise.all([
        fetch("/api/v1/isms/certification/readiness"),
        fetch("/api/v1/isms/certification/timeline"),
      ]);

      if (readinessRes.ok) {
        const json = await readinessRes.json();
        setReadiness(json.data);
      }
      if (timelineRes.ok) {
        const json = await timelineRes.json();
        setTimeline(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchPriorities = useCallback(async () => {
    const res = await fetch("/api/v1/isms/certification/ai-priority", {
      method: "POST",
    });
    if (res.ok) {
      const json = await res.json();
      setPriorities(json.data.priorities);
    }
  }, []);

  if (loading && !readiness) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const score = readiness?.score ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Readiness Score + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Gauge */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
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
              <span className="text-3xl font-bold text-gray-900">{score}%</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mt-3">{t("readinessScore")}</p>
          <p className="text-xs text-gray-400 mt-1">
            {readiness?.passedCount}/{readiness?.totalChecks} {t("checksPassed")}
          </p>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("timelineTitle")}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t("openGaps")}</span>
              <span className="text-sm font-bold text-gray-900">{timeline?.openGaps ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t("closedLastMonth")}</span>
              <span className="text-sm font-bold text-gray-900">{timeline?.closedLastMonth ?? "-"}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t("estimatedWeeks")}</span>
                <span className="text-lg font-bold text-blue-600">
                  {timeline?.estimatedWeeks !== null && timeline?.estimatedWeeks !== undefined
                    ? `${timeline.estimatedWeeks} ${t("weeks")}`
                    : t("notEstimable")}
                </span>
              </div>
              {timeline?.estimatedDate && (
                <p className="text-xs text-gray-400 text-right mt-1">
                  ~ {new Date(timeline.estimatedDate).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI Priority */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">{t("aiPriority")}</h3>
            {priorities.length === 0 && (
              <Button variant="outline" size="sm" onClick={fetchPriorities}>
                {t("analyze")}
              </Button>
            )}
          </div>
          {priorities.length > 0 ? (
            <div className="space-y-3">
              {priorities.map((p) => (
                <div key={p.rank} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {p.rank}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {p.catalogCode}: {p.catalogTitle}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.reason}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {p.estimatedEffort}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t("aiPriorityDescription")}</p>
          )}
        </div>
      </div>

      {/* Certification Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CERTIFICATIONS.map((cert) => (
          <Link
            key={cert.id}
            href={`/isms/certifications/${cert.id}`}
            className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow cursor-pointer transition-colors block"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-base font-semibold text-blue-700 hover:text-blue-900">{cert.name}</h3>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {t("notStarted")}
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: cert.id === "iso27001" ? `${score}%` : "0%" }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {cert.id === "iso27001" ? `${score}%` : "0%"} {t("ready")}
            </p>
          </Link>
        ))}
      </div>

      {/* Readiness Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("checklist")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("checklistDescription")}</p>
        </div>
        <div className="divide-y divide-gray-100">
          {readiness?.checks.map((check) => (
            <div key={check.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {check.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{check.labelDE}</p>
                  {check.details && (
                    <p className="text-xs text-gray-500 mt-0.5">{check.details}</p>
                  )}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  check.passed
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {check.passed ? t("passed") : t("failed")}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
