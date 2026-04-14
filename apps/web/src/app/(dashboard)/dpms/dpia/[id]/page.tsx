"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle, Plus, AlertTriangle, ShieldCheck, Save } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dpia, DpiaRisk, DpiaMeasure } from "@grc/shared";

const WIZARD_STEPS = ["prescreen", "description", "necessity", "risks", "measures", "signOff"] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-teal-100 text-teal-900",
  pending_dpo_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

interface CriteriaCatalogEntry {
  id: string;
  code: string;
  title: string;
  description?: string;
}

export default function DpiaDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DpiaDetailInner />
    </ModuleGate>
  );
}

interface DpiaRiskExtended extends DpiaRisk {
  numericLikelihood?: number | null;
  numericImpact?: number | null;
  riskScore?: number | null;
  ermRiskId?: string | null;
  numeric_likelihood?: number | null;
  numeric_impact?: number | null;
  risk_score?: number | null;
  erm_risk_id?: string | null;
}

interface DpiaDetailData extends Dpia {
  risks: DpiaRiskExtended[];
  measures: DpiaMeasure[];
  signOffName?: string;
}

function DpiaDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DpiaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<WizardStep>("prescreen");
  const [signingOff, setSigningOff] = useState(false);

  // Pre-screening state
  const [criteria, setCriteria] = useState<CriteriaCatalogEntry[]>([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [checkedCriteria, setCheckedCriteria] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCriteria = useCallback(async () => {
    setCriteriaLoading(true);
    try {
      const res = await fetch("/api/v1/dpms/templates?source=arctos_dpia_criteria");
      if (res.ok) {
        const json = await res.json();
        setCriteria(json.data ?? []);
      }
    } finally {
      setCriteriaLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchCriteria();
  }, [fetchData, fetchCriteria]);

  const toggleCriterion = (code: string) => {
    setCheckedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const dpiaRequired = checkedCriteria.size >= 2;

  const handleSignOff = async () => {
    setSigningOff(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${id}/sign-off`, { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setSigningOff(false);
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
    return <p className="text-center text-gray-500 py-8">{t("dpia.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dpms/dpia")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <Badge variant="outline" className={STATUS_COLORS[data.status] ?? ""}>
              {data.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Wizard Steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step, idx) => (
          <button
            type="button"
            key={step}
            onClick={() => setActiveStep(step)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeStep === step
                ? "bg-blue-100 text-blue-900"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center justify-center h-6 w-6 rounded-full border text-xs font-bold">
              {idx + 1}
            </span>
            {t(`dpia.steps.${step}`)}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {activeStep === "prescreen" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t("dpia.prescreen.title")}</h2>
              {checkedCriteria.size > 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    dpiaRequired
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  {checkedCriteria.size} / {criteria.length} {t("dpia.prescreen.criteriaMatched")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">{t("dpia.prescreen.description")}</p>

            {/* DPIA Required indicator */}
            {checkedCriteria.size > 0 && (
              <div
                className={`rounded-lg p-4 flex items-center gap-3 ${
                  dpiaRequired
                    ? "bg-red-50 border border-red-200"
                    : "bg-green-50 border border-green-200"
                }`}
              >
                {dpiaRequired ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-800">{t("dpia.prescreen.dpiaRequired")}</p>
                      <p className="text-sm text-red-700">{t("dpia.prescreen.dpiaRequiredHint")}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">{t("dpia.prescreen.dpiaNotRequired")}</p>
                      <p className="text-sm text-green-700">{t("dpia.prescreen.dpiaNotRequiredHint")}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Criteria checklist */}
            {criteriaLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                {t("dpia.prescreen.loading")}
              </div>
            ) : criteria.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">{t("dpia.prescreen.noCriteria")}</p>
            ) : (
              <div className="space-y-2">
                {criteria.map((criterion) => (
                  <label
                    key={criterion.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      checkedCriteria.has(criterion.code)
                        ? "bg-blue-50 border-blue-200"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedCriteria.has(criterion.code)}
                      onChange={() => toggleCriterion(criterion.code)}
                      className="h-4 w-4 rounded text-blue-600 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{criterion.title}</span>
                      {criterion.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{criterion.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {activeStep === "description" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">{t("dpia.steps.description")}</h2>
            <FieldRow label={t("dpia.processingDescription")} value={data.processingDescription ?? "-"} />
            <FieldRow label={t("ropa.legalBasisLabel")} value={data.legalBasis?.replace(/_/g, " ") ?? "-"} />
          </div>
        )}

        {activeStep === "necessity" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">{t("dpia.steps.necessity")}</h2>
            <FieldRow label={t("dpia.necessityAssessment")} value={data.necessityAssessment ?? "-"} />
            <FieldRow label={t("dpia.consultationLabel")} value={data.dpoConsultationRequired ? t("ropa.yes") : t("ropa.no")} />
          </div>
        )}

        {activeStep === "risks" && (
          <DpiaRiskStep
            risks={data.risks}
            dpiaId={data.id}
            t={t}
            onUpdated={fetchData}
          />
        )}

        {activeStep === "measures" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t("dpia.steps.measures")}</h2>
              <span className="text-sm text-gray-500">{data.measures.length} {t("dpia.measuresCount")}</span>
            </div>
            {data.measures.length === 0 ? (
              <p className="text-sm text-gray-400">{t("dpia.noMeasures")}</p>
            ) : (
              <div className="space-y-3">
                {data.measures.map((measure) => (
                  <div key={measure.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm text-gray-900">{measure.measureDescription}</p>
                    {measure.implementationTimeline && (
                      <p className="text-xs text-gray-500 mt-1">{t("dpia.timeline")}: {measure.implementationTimeline}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeStep === "signOff" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">{t("dpia.steps.signOff")}</h2>
            {data.residualRiskSignOffId ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">{t("dpia.signedOff")}</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {t("dpia.signedOffBy")}: {data.signOffName ?? data.residualRiskSignOffId}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{t("dpia.signOffDescription")}</p>
                <Button
                  size="sm"
                  onClick={handleSignOff}
                  disabled={signingOff || data.status !== "pending_dpo_review"}
                >
                  <CheckCircle size={14} className="mr-1" />
                  {t("dpia.approveButton")}
                </Button>
                {data.status !== "pending_dpo_review" && (
                  <p className="text-xs text-amber-600">{t("dpia.mustBePendingReview")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={activeStep === WIZARD_STEPS[0]}
          onClick={() => {
            const idx = WIZARD_STEPS.indexOf(activeStep);
            if (idx > 0) setActiveStep(WIZARD_STEPS[idx - 1]);
          }}
        >
          {t("dpia.back")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={activeStep === WIZARD_STEPS[WIZARD_STEPS.length - 1]}
          onClick={() => {
            const idx = WIZARD_STEPS.indexOf(activeStep);
            if (idx < WIZARD_STEPS.length - 1) setActiveStep(WIZARD_STEPS[idx + 1]);
          }}
        >
          {t("dpia.next")}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}

// ── Numeric Risk Scoring Step ────────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  1: "Sehr gering",
  2: "Gering",
  3: "Mittel",
  4: "Hoch",
  5: "Sehr hoch",
};

function riskScoreColor(score: number): string {
  if (score >= 20) return "bg-red-600 text-white";
  if (score >= 12) return "bg-orange-500 text-white";
  if (score >= 6) return "bg-yellow-400 text-yellow-900";
  return "bg-green-400 text-green-900";
}

function riskScoreLabel(score: number): string {
  if (score >= 20) return "Kritisch";
  if (score >= 12) return "Hoch";
  if (score >= 6) return "Mittel";
  return "Gering";
}

function DpiaRiskStep({
  risks,
  dpiaId,
  t,
  onUpdated,
}: {
  risks: DpiaRiskExtended[];
  dpiaId: string;
  t: ReturnType<typeof useTranslations>;
  onUpdated: () => void;
}) {
  // Local state for numeric edits keyed by risk.id
  const [edits, setEdits] = useState<
    Record<string, { likelihood: number; impact: number }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);

  const getNumericLikelihood = (risk: DpiaRiskExtended): number =>
    risk.numericLikelihood ?? risk.numeric_likelihood ?? 0;
  const getNumericImpact = (risk: DpiaRiskExtended): number =>
    risk.numericImpact ?? risk.numeric_impact ?? 0;
  const getRiskScore = (risk: DpiaRiskExtended): number =>
    risk.riskScore ?? risk.risk_score ?? 0;

  const getEdit = (risk: DpiaRiskExtended) =>
    edits[risk.id] ?? {
      likelihood: getNumericLikelihood(risk) || 3,
      impact: getNumericImpact(risk) || 3,
    };

  const setEdit = (riskId: string, field: "likelihood" | "impact", value: number) => {
    setEdits((prev) => ({
      ...prev,
      [riskId]: { ...getEditById(riskId, prev), [field]: value },
    }));
  };

  const getEditById = (
    riskId: string,
    current: Record<string, { likelihood: number; impact: number }>,
  ) => {
    if (current[riskId]) return current[riskId];
    const risk = risks.find((r) => r.id === riskId);
    if (!risk) return { likelihood: 3, impact: 3 };
    return {
      likelihood: getNumericLikelihood(risk) || 3,
      impact: getNumericImpact(risk) || 3,
    };
  };

  const handleSave = async (riskId: string) => {
    const edit = edits[riskId];
    if (!edit) return;

    setSaving(riskId);
    try {
      await fetch(`/api/v1/dpms/dpia/${dpiaId}/risks/${riskId}/numeric-score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numericLikelihood: edit.likelihood,
          numericImpact: edit.impact,
        }),
      });
      onUpdated();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{t("dpia.steps.risks")}</h2>
        <span className="text-sm text-gray-500">
          {risks.length} {t("dpia.risksCount")}
        </span>
      </div>
      {risks.length === 0 ? (
        <p className="text-sm text-gray-400">{t("dpia.noRisks")}</p>
      ) : (
        <div className="space-y-4">
          {risks.map((risk) => {
            const edit = getEdit(risk);
            const computedScore = edit.likelihood * edit.impact;
            const existingScore = getRiskScore(risk);
            const hasChanged =
              edit.likelihood !== (getNumericLikelihood(risk) || 3) ||
              edit.impact !== (getNumericImpact(risk) || 3);

            return (
              <div
                key={risk.id}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
              >
                <p className="text-sm text-gray-900 font-medium">
                  {risk.riskDescription}
                </p>

                {/* Existing string-based badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {t("dpia.severity")}: {risk.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {t("dpia.likelihood")}: {risk.likelihood}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {t("dpia.impact")}: {risk.impact}
                  </Badge>
                  {(risk.erm_risk_id || risk.ermRiskId) && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-green-50 text-green-700 border-green-200"
                    >
                      Im ERM synchronisiert
                    </Badge>
                  )}
                </div>

                {/* Numeric Scoring */}
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Numerische Bewertung
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Likelihood */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Eintrittswahrscheinlichkeit (1-5)
                      </label>
                      <select
                        value={edit.likelihood}
                        onChange={(e) =>
                          setEdit(risk.id, "likelihood", Number(e.target.value))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v} - {SCORE_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Impact */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Auswirkung (1-5)
                      </label>
                      <select
                        value={edit.impact}
                        onChange={(e) =>
                          setEdit(risk.id, "impact", Number(e.target.value))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v} - {SCORE_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Computed Score */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Risiko-Score
                      </label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-bold min-w-[3rem] ${riskScoreColor(computedScore)}`}
                        >
                          {computedScore}
                        </span>
                        <span className="text-xs text-gray-500">
                          {riskScoreLabel(computedScore)}
                        </span>
                        {existingScore > 0 && existingScore !== computedScore && (
                          <span className="text-xs text-gray-400">
                            (gespeichert: {existingScore})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  {hasChanged && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(risk.id)}
                        disabled={saving === risk.id}
                      >
                        {saving === risk.id ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Save size={12} className="mr-1" />
                        )}
                        Bewertung speichern
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
