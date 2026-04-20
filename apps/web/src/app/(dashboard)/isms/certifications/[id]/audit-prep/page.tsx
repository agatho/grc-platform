"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileDown,
  ClipboardList,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
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

interface GapItem {
  id: string;
  catalogCode: string;
  catalogTitleDe: string;
  catalogTitleEn: string;
  implementation: string;
  controlId: string | null;
}

export default function AuditPrepPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AuditPrepInner />
    </ModuleGate>
  );
}

function AuditPrepInner() {
  const t = useTranslations("certifications");
  const params = useParams();
  const frameworkId = params.id as string;

  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [readinessRes, gapRes] = await Promise.all([
        fetch("/api/v1/isms/certification/readiness"),
        fetch("/api/v1/isms/certification/gaps?limit=100"),
      ]);

      if (readinessRes.ok) {
        const json = await readinessRes.json();
        setReadiness(json.data);
      }
      if (gapRes.ok) {
        const json = await gapRes.json();
        setGaps(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Trigger export job (would be a background worker in production)
      await fetch("/api/v1/isms/certification/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework: frameworkId }),
      });
      // In production, this would trigger a worker job and notify when ready
      alert(t("exportStarted"));
    } finally {
      setExporting(false);
    }
  }, [frameworkId, t]);

  if (loading && !readiness) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const frameworkNames: Record<string, string> = {
    iso27001: "ISO 27001",
    soc2: "SOC 2",
    tisax: "TISAX",
    c5: "BSI C5",
    iso22301: "ISO 22301",
    iso27701: "ISO 27701",
  };

  // Pre-audit checklist
  const preAuditChecks = [
    {
      id: "mgmt_review",
      label: t("audit.mgmtReview"),
      done:
        readiness?.checks.find((c) => c.id === "mgmt_review")?.passed ?? false,
    },
    {
      id: "internal_audit",
      label: t("audit.internalAudit"),
      done:
        readiness?.checks.find((c) => c.id === "internal_audit")?.passed ??
        false,
    },
    {
      id: "findings_closed",
      label: t("audit.findingsClosed"),
      done:
        readiness?.checks.find((c) => c.id === "findings_closed")?.passed ??
        false,
    },
    {
      id: "documentation",
      label: t("audit.documentation"),
      done:
        readiness?.checks.find((c) => c.id === "policy_current")?.passed ??
        false,
    },
    {
      id: "scope",
      label: t("audit.scopeDefined"),
      done:
        readiness?.checks.find((c) => c.id === "scope_defined")?.passed ??
        false,
    },
    {
      id: "soa",
      label: t("audit.soaComplete"),
      done:
        readiness?.checks.find((c) => c.id === "soa_complete")?.passed ?? false,
    },
  ];

  const completedCount = preAuditChecks.filter((c) => c.done).length;
  const totalCount = preAuditChecks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/isms/certifications/${frameworkId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("auditPrep")} - {frameworkNames[frameworkId] ?? frameworkId}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("auditPrepDescription")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <FileDown size={14} className="mr-1" />
            {exporting ? t("exporting") : t("exportPackage")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("audit.progress")}
          </h3>
          <span className="text-sm font-bold text-gray-700">
            {completedCount}/{totalCount} (
            {Math.round((completedCount / totalCount) * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              completedCount === totalCount
                ? "bg-green-500"
                : completedCount >= totalCount / 2
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Pre-Audit Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gray-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {t("audit.checklist")}
            </h2>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {preAuditChecks.map((check) => (
            <div
              key={check.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {check.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm text-gray-900">{check.label}</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  check.done
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {check.done ? t("passed") : t("open")}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Collection Summary */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t("audit.evidenceCollection")}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {gaps.filter((g) => g.controlId).length} / {gaps.length}{" "}
            {t("audit.controlsWithEvidence")}
          </p>
        </div>
        {gaps.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {t("audit.noControlsNeeded")}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {gaps.slice(0, 30).map((gap) => (
              <div
                key={gap.id}
                className="px-4 py-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {gap.controlId ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 truncate">
                    <span className="font-mono text-gray-400 mr-1">
                      {gap.catalogCode}
                    </span>
                    {gap.catalogTitleDe || gap.catalogTitleEn}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] ${
                    gap.controlId
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {gap.controlId ? t("audit.linked") : t("audit.missing")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
