"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Download,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  score: number;
  maxScore: number;
  percent: number;
  previousPercent?: number;
}

interface QuestionResult {
  id: string;
  sectionId: string;
  questionText: string;
  answer: string;
  score: number;
  maxScore: number;
  hasEvidence: boolean;
  isGap: boolean;
}

interface EvidenceItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  virusScanStatus: string;
  uploadedAt: string;
  questionId?: string;
}

interface ResultsData {
  session: {
    id: string;
    vendorName: string;
    templateName: string;
    submittedAt: string;
    totalScore: number;
    maxPossibleScore: number;
    progressPercent: number;
    status: string;
  };
  sectionScores: SectionScore[];
  questions: QuestionResult[];
  evidence: EvidenceItem[];
  tierRecommendation: string;
  previousComparison?: {
    sections: Array<{
      sectionTitle: string;
      currentPercent: number;
      previousPercent: number;
      trend: "improved" | "declined" | "unchanged";
    }>;
  };
}

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  important: "bg-yellow-100 text-yellow-800 border-yellow-200",
  standard: "bg-gray-100 text-gray-800 border-gray-200",
  low_risk: "bg-green-100 text-green-800 border-green-200",
};

const SCAN_COLORS: Record<string, string> = {
  clean: "bg-green-100 text-green-900",
  pending: "bg-gray-100 text-gray-600",
  infected: "bg-red-100 text-red-900",
};

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function DdResultsPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <DdResultsInner />
    </ModuleGate>
  );
}

function DdResultsInner() {
  const t = useTranslations("ddResults");
  const tPortal = useTranslations("portal");
  const router = useRouter();
  const { id: vendorId, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  // ──────────────────────────────────────────────────────────────
  // Fetch
  // ──────────────────────────────────────────────────────────────

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/vendors/${vendorId}/dd-sessions/${sessionId}/results`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [vendorId, sessionId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  // ──────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/vendors/${vendorId}/dd-sessions/${sessionId}/accept`,
        { method: "POST" },
      );
      if (res.ok) {
        toast.success("Assessment accepted");
        void fetchResults();
      }
    } catch {
      toast.error("Failed to accept assessment");
    }
  }, [vendorId, sessionId, fetchResults]);

  const handleExportPdf = useCallback(() => {
    window.open(
      `/api/v1/vendors/${vendorId}/dd-sessions/${sessionId}/export-pdf`,
      "_blank",
    );
  }, [vendorId, sessionId]);

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No results available</p>
      </div>
    );
  }

  const {
    session: sess,
    sectionScores,
    questions,
    evidence,
    tierRecommendation,
    previousComparison,
  } = data;
  const scorePercent =
    sess.maxPossibleScore > 0
      ? Math.round((sess.totalScore / sess.maxPossibleScore) * 100)
      : 0;

  const scoreColor =
    scorePercent >= 80
      ? "text-green-600"
      : scorePercent >= 50
        ? "text-yellow-600"
        : "text-red-600";

  const gapQuestions = questions.filter((q) => q.isGap);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/tprm/vendors/${vendorId}`)}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {t("title")}: {sess.vendorName}
          </h1>
          <p className="text-xs text-gray-500">
            {sess.templateName} &middot;{" "}
            {new Date(sess.submittedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download size={14} />
            {tPortal("exportPdf")}
          </Button>
          <Button size="sm" onClick={handleAccept}>
            <CheckCircle2 size={14} />
            {tPortal("acceptAssessment")}
          </Button>
        </div>
      </div>

      {/* Score overview + Tier recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score gauge */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            {t("overallScore")}
          </p>
          <div className="relative inline-flex items-center justify-center w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={
                  scorePercent >= 80
                    ? "#22c55e"
                    : scorePercent >= 50
                      ? "#eab308"
                      : "#ef4444"
                }
                strokeWidth="10"
                strokeDasharray={`${scorePercent * 3.14} 314`}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`absolute text-2xl font-bold ${scoreColor}`}
            >
              {scorePercent}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {sess.totalScore} / {sess.maxPossibleScore}
          </p>
        </div>

        {/* Tier recommendation */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            {tPortal("tierRecommendation")}
          </p>
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} className="text-blue-500" />
            <Badge
              variant="outline"
              className={`text-base px-3 py-1 ${TIER_COLORS[tierRecommendation] ?? ""}`}
            >
              {tierRecommendation
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Based on score: {scorePercent}%
          </p>
        </div>

        {/* Gap summary */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            Gaps Identified
          </p>
          <div className="flex items-center gap-3">
            <AlertTriangle
              size={24}
              className={
                gapQuestions.length > 0 ? "text-red-500" : "text-green-500"
              }
            />
            <span className="text-2xl font-bold text-gray-900">
              {gapQuestions.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Questions with score = 0 or missing evidence
          </p>
        </div>
      </div>

      {/* Section scores bar chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {t("sectionBreakdown")}
        </h3>
        <div className="space-y-3">
          {sectionScores.map((ss) => {
            const barColor =
              ss.percent >= 80
                ? "bg-green-500"
                : ss.percent >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500";
            return (
              <div key={ss.sectionId}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">
                    {ss.sectionTitle}
                  </span>
                  <span className="text-gray-500">
                    {ss.score}/{ss.maxScore} ({ss.percent}%)
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${ss.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question details per section (expandable) */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("questionDetails")}
          </h3>
        </div>
        {sectionScores.map((ss) => {
          const sectionQuestions = questions.filter(
            (q) => q.sectionId === ss.sectionId,
          );
          const isExpanded = expandedSections.has(ss.sectionId);
          return (
            <div key={ss.sectionId} className="border-b border-gray-50">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(ss.sectionId))
                      next.delete(ss.sectionId);
                    else next.add(ss.sectionId);
                    return next;
                  })
                }
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">
                  {ss.sectionTitle}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ss.score}/{ss.maxScore}
                  </Badge>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-gray-500 font-medium">
                          Question
                        </th>
                        <th className="text-left py-2 text-gray-500 font-medium">
                          {t("answer")}
                        </th>
                        <th className="text-right py-2 text-gray-500 font-medium w-16">
                          {t("score")}
                        </th>
                        <th className="text-right py-2 text-gray-500 font-medium w-16">
                          {t("maxScore")}
                        </th>
                        <th className="text-center py-2 text-gray-500 font-medium w-20">
                          {t("evidence")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionQuestions.map((q) => (
                        <tr
                          key={q.id}
                          className={`border-b border-gray-50 ${
                            q.isGap ? "bg-red-50" : ""
                          }`}
                        >
                          <td className="py-2 text-gray-700 max-w-xs truncate">
                            {q.questionText}
                          </td>
                          <td className="py-2 text-gray-600 max-w-xs truncate">
                            {q.answer || (
                              <span className="text-gray-400 italic">
                                {t("noAnswer")}
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right font-medium">
                            <span
                              className={
                                q.score === 0
                                  ? "text-red-600"
                                  : "text-gray-700"
                              }
                            >
                              {q.score}
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-500">
                            {q.maxScore}
                          </td>
                          <td className="py-2 text-center">
                            {q.hasEvidence ? (
                              <FileText
                                size={14}
                                className="inline text-blue-500"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Evidence panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {tPortal("evidenceList")} ({evidence.length})
        </h3>
        {evidence.length === 0 ? (
          <p className="text-sm text-gray-400">{tPortal("noEvidence")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evidence.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-800">
                      {ev.fileName}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {Math.round(ev.fileSize / 1024)} KB &middot;{" "}
                      {new Date(ev.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${SCAN_COLORS[ev.virusScanStatus] ?? ""}`}
                  >
                    {ev.virusScanStatus}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/api/v1/vendors/${vendorId}/dd-sessions/${sessionId}/evidence/${ev.id}`,
                        "_blank",
                      )
                    }
                  >
                    <Download size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison panel */}
      {previousComparison && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {tPortal("comparison")}
          </h3>
          <div className="space-y-3">
            {previousComparison.sections.map((cs) => (
              <div
                key={cs.sectionTitle}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-gray-700">
                  {cs.sectionTitle}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    {cs.previousPercent}%
                  </span>
                  {cs.trend === "improved" && (
                    <TrendingUp size={14} className="text-green-500" />
                  )}
                  {cs.trend === "declined" && (
                    <TrendingDown size={14} className="text-red-500" />
                  )}
                  {cs.trend === "unchanged" && (
                    <Minus size={14} className="text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900">
                    {cs.currentPercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" size="sm">
          <MessageSquare size={14} />
          {tPortal("requestClarification")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Download size={14} />
          {tPortal("exportPdf")}
        </Button>
        <Button size="sm" onClick={handleAccept}>
          <CheckCircle2 size={14} />
          {tPortal("acceptAssessment")}
        </Button>
      </div>
    </div>
  );
}
