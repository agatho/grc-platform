"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Play } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AssessmentRun, AssessmentControlEval, AssessmentRiskEval, EvalResult } from "@grc/shared";

const RESULT_COLORS: Record<EvalResult, string> = {
  effective: "bg-green-100 text-green-900",
  partially_effective: "bg-yellow-100 text-yellow-900",
  ineffective: "bg-red-100 text-red-900",
  not_applicable: "bg-gray-100 text-gray-600",
  not_evaluated: "bg-gray-50 text-gray-400",
};

export default function AssessmentDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AssessmentDetailInner />
    </ModuleGate>
  );
}

function AssessmentDetailInner() {
  const t = useTranslations("ismsAssessment");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assessment, setAssessment] = useState<AssessmentRun | null>(null);
  const [evaluations, setEvaluations] = useState<AssessmentControlEval[]>([]);
  const [riskEvals, setRiskEvals] = useState<AssessmentRiskEval[]>([]);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "evaluations" | "risks">("overview");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, eRes, rRes, pRes] = await Promise.all([
        fetch(`/api/v1/isms/assessments/${id}`),
        fetch(`/api/v1/isms/assessments/${id}/evaluations?limit=100`),
        fetch(`/api/v1/isms/assessments/${id}/risk-evaluations?limit=100`),
        fetch(`/api/v1/isms/assessments/${id}/progress`),
      ]);
      if (aRes.ok) { const j = await aRes.json(); setAssessment(j.data); }
      if (eRes.ok) { const j = await eRes.json(); setEvaluations(j.data ?? []); }
      if (rRes.ok) { const j = await rRes.json(); setRiskEvals(j.data ?? []); }
      if (pRes.ok) { const j = await pRes.json(); setProgress(j.data); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !assessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!assessment) {
    return <p className="text-center text-gray-400 py-12">{t("assessment.notFound")}</p>;
  }

  const p = progress as {
    controls?: { total: number; completed: number; completionPercentage: number; effective: number; partiallyEffective: number; ineffective: number; notApplicable: number; notEvaluated: number };
    risks?: { total: number; completed: number };
    maturity?: { avgCurrent: number; avgTarget: number; avgGap: number };
  } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/isms/assessments")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{assessment.name}</h1>
            <p className="text-sm text-gray-500">{assessment.framework} | {assessment.periodStart} - {assessment.periodEnd}</p>
          </div>
        </div>
        <Link href={`/isms/assessments/${id}/wizard`}>
          <Button>
            <Play size={14} className="mr-1" /> {t("assessment.continue")}
          </Button>
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">{t("assessment.progress")}</span>
          <span className="text-gray-500">{assessment.completionPercentage}% ({assessment.completedEvaluations}/{assessment.totalEvaluations})</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${assessment.completionPercentage}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "evaluations", "risks"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`assessment.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && p && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("evaluation.effective")} value={p.controls?.effective ?? 0} color="text-green-600" />
          <StatCard label={t("evaluation.partiallyEffective")} value={p.controls?.partiallyEffective ?? 0} color="text-yellow-600" />
          <StatCard label={t("evaluation.ineffective")} value={p.controls?.ineffective ?? 0} color="text-red-600" />
          <StatCard label={t("evaluation.notEvaluated")} value={p.controls?.notEvaluated ?? 0} color="text-gray-400" />
          <StatCard label={t("maturity.avgCurrent")} value={p.maturity?.avgCurrent ?? 0} color="text-purple-600" />
          <StatCard label={t("maturity.avgTarget")} value={p.maturity?.avgTarget ?? 0} color="text-purple-400" />
          <StatCard label={t("maturity.gap")} value={p.maturity?.avgGap ?? 0} color="text-orange-600" />
          <StatCard label={t("riskEval.scenariosEvaluated")} value={`${p.risks?.completed ?? 0}/${p.risks?.total ?? 0}`} color="text-blue-600" />
        </div>
      )}

      {activeTab === "evaluations" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("evaluation.control")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("evaluation.result")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("maturity.current")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("maturity.target")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("evaluation.assessedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluations.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t("evaluation.empty")}</td></tr>
              ) : (
                evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{ev.controlId.slice(0, 8)}...</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={RESULT_COLORS[ev.result]}>{t(`evaluation.results.${ev.result}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{ev.currentMaturity ?? "-"}</td>
                    <td className="px-4 py-3 text-center">{ev.targetMaturity ?? "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{ev.assessedAt ? new Date(ev.assessedAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "risks" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("riskEval.scenario")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("riskEval.residualLikelihood")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("riskEval.residualImpact")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("riskEval.decision")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riskEvals.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t("riskEval.empty")}</td></tr>
              ) : (
                riskEvals.map((re) => (
                  <tr key={re.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{re.riskScenarioId.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-center">{re.residualLikelihood ?? "-"}</td>
                    <td className="px-4 py-3 text-center">{re.residualImpact ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={re.decision === "pending" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-900"}>
                        {t(`riskEval.decisions.${re.decision}`)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
    </div>
  );
}
