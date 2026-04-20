"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AssessmentRun, EvalResult, RiskDecision } from "@grc/shared";

interface AssetItem {
  id: string;
  name: string;
  assetTier: string;
}

interface ControlItem {
  id: string;
  title: string;
  controlType: string;
  department?: string;
}

interface RiskScenarioItem {
  id: string;
  description?: string;
  assetId?: string;
  threatId?: string;
}

const STEPS = ["assets", "controls", "risks"] as const;
type Step = (typeof STEPS)[number];

export default function WizardPage() {
  return (
    <ModuleGate moduleKey="isms">
      <WizardInner />
    </ModuleGate>
  );
}

function WizardInner() {
  const t = useTranslations("ismsAssessment");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assessment, setAssessment] = useState<AssessmentRun | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("assets");
  const [loading, setLoading] = useState(true);

  // Step 1: Assets
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // Step 2: Controls
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [controlIndex, setControlIndex] = useState(0);
  const [evalResult, setEvalResult] = useState<EvalResult>("not_evaluated");
  const [currentMaturity, setCurrentMaturity] = useState<number>(1);
  const [targetMaturity, setTargetMaturity] = useState<number>(3);
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");

  // Step 3: Risk Scenarios
  const [riskScenarios, setRiskScenarios] = useState<RiskScenarioItem[]>([]);
  const [riskIndex, setRiskIndex] = useState(0);
  const [residualLikelihood, setResidualLikelihood] = useState(3);
  const [residualImpact, setResidualImpact] = useState(3);
  const [riskDecision, setRiskDecision] = useState<RiskDecision>("pending");
  const [riskJustification, setRiskJustification] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, assetRes, ctrlRes, rsRes] = await Promise.all([
        fetch(`/api/v1/isms/assessments/${id}`),
        fetch("/api/v1/assets?limit=200"),
        fetch("/api/v1/controls?limit=200"),
        fetch("/api/v1/isms/risk-scenarios?limit=200"),
      ]);
      if (aRes.ok) {
        const j = await aRes.json();
        setAssessment(j.data);
      }
      if (assetRes.ok) {
        const j = await assetRes.json();
        setAssets(j.data ?? []);
        setSelectedAssets(new Set((j.data ?? []).map((a: AssetItem) => a.id)));
      }
      if (ctrlRes.ok) {
        const j = await ctrlRes.json();
        setControls(j.data ?? []);
      }
      if (rsRes.ok) {
        const j = await rsRes.json();
        setRiskScenarios(j.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleAsset = (assetId: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const submitEvaluation = async () => {
    const ctrl = controls[controlIndex];
    if (!ctrl) return;

    await fetch(`/api/v1/isms/assessments/${id}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        controlId: ctrl.id,
        result: evalResult,
        currentMaturity,
        targetMaturity,
        evidence,
        notes,
        evidenceDocumentIds: [],
      }),
    });

    // Move to next control
    if (controlIndex < controls.length - 1) {
      setControlIndex(controlIndex + 1);
      setEvalResult("not_evaluated");
      setCurrentMaturity(1);
      setTargetMaturity(3);
      setEvidence("");
      setNotes("");
    }
  };

  const submitRiskEval = async () => {
    const scenario = riskScenarios[riskIndex];
    if (!scenario) return;

    await fetch(`/api/v1/isms/assessments/${id}/risk-evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riskScenarioId: scenario.id,
        residualLikelihood,
        residualImpact,
        decision: riskDecision,
        justification: riskJustification,
      }),
    });

    if (riskIndex < riskScenarios.length - 1) {
      setRiskIndex(riskIndex + 1);
      setResidualLikelihood(3);
      setResidualImpact(3);
      setRiskDecision("pending");
      setRiskJustification("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(currentStep);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/isms/assessments/${id}`)}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("assessment.wizard")}
          </h1>
          <p className="text-sm text-gray-500">{assessment?.name}</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < stepIndex
                    ? "bg-green-500 text-white"
                    : i === stepIndex
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < stepIndex ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${i === stepIndex ? "text-blue-600" : "text-gray-500"}`}
              >
                {t(`assessment.steps.${step}`)}
              </span>
              {i < STEPS.length - 1 && (
                <div className="w-16 h-0.5 bg-gray-200 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Asset Selection */}
      {currentStep === "assets" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            {t("assessment.step1")}
          </h2>
          <p className="text-sm text-gray-500">
            {selectedAssets.size} {t("assessment.assetsSelected")} x{" "}
            {controls.length} {t("evaluation.controls")} ={" "}
            {selectedAssets.size * controls.length}{" "}
            {t("evaluation.evaluations")}
          </p>
          <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
            {assets.map((asset) => (
              <label
                key={asset.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedAssets.has(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-900">
                  {asset.name}
                </span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {asset.assetTier}
                </Badge>
              </label>
            ))}
            {assets.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                {t("assessment.noAssets")}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCurrentStep("controls")}>
              {t("assessment.next")} <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Control Evaluation */}
      {currentStep === "controls" && controls.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {t("assessment.step2")}
            </h2>
            <span className="text-sm text-gray-500">
              {controlIndex + 1} / {controls.length}
            </span>
          </div>

          {/* Control Card */}
          <div className="border border-gray-200 rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {controls[controlIndex]?.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {controls[controlIndex]?.controlType} |{" "}
                {controls[controlIndex]?.department ?? "-"}
              </p>
            </div>

            {/* Result Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                {t("evaluation.result")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    "effective",
                    "partially_effective",
                    "ineffective",
                    "not_applicable",
                  ] as const
                ).map((r) => (
                  <button
                    key={r}
                    onClick={() => setEvalResult(r)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      evalResult === r
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {t(`evaluation.results.${r}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Maturity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("maturity.current")}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCurrentMaturity(n)}
                      className={`w-9 h-9 text-sm font-bold rounded-md border ${
                        currentMaturity === n
                          ? "bg-purple-500 text-white border-purple-500"
                          : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("maturity.target")}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTargetMaturity(n)}
                      className={`w-9 h-9 text-sm font-bold rounded-md border ${
                        targetMaturity === n
                          ? "bg-purple-500 text-white border-purple-500"
                          : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t("evaluation.evidence")}
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={t("evaluation.evidencePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t("evaluation.notes")}
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  controlIndex > 0
                    ? setControlIndex(controlIndex - 1)
                    : setCurrentStep("assets")
                }
              >
                <ChevronLeft size={14} className="mr-1" />{" "}
                {t("assessment.back")}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (controlIndex < controls.length - 1)
                    setControlIndex(controlIndex + 1);
                  else setCurrentStep("risks");
                }}
              >
                {t("evaluation.skip")}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await submitEvaluation();
                  if (controlIndex >= controls.length - 1)
                    setCurrentStep("risks");
                }}
              >
                {t("evaluation.saveAndNext")}{" "}
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Risk Scenarios */}
      {currentStep === "risks" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {t("assessment.step3")}
            </h2>
            <span className="text-sm text-gray-500">
              {riskScenarios.length > 0
                ? `${riskIndex + 1} / ${riskScenarios.length}`
                : "0"}
            </span>
          </div>

          {riskScenarios.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {t("riskEval.empty")}
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg p-5 space-y-4">
              <p className="text-sm text-gray-700">
                {riskScenarios[riskIndex]?.description ??
                  t("riskEval.noDescription")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    {t("riskEval.residualLikelihood")}
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setResidualLikelihood(n)}
                        className={`w-9 h-9 text-sm font-bold rounded-md border ${
                          residualLikelihood === n
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-300"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    {t("riskEval.residualImpact")}
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setResidualImpact(n)}
                        className={`w-9 h-9 text-sm font-bold rounded-md border ${
                          residualImpact === n
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-300"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <span className="text-sm font-medium text-gray-600">
                  {t("riskEval.residualRisk")}:{" "}
                </span>
                <span
                  className={`text-lg font-bold ${
                    residualLikelihood * residualImpact >= 16
                      ? "text-red-600"
                      : residualLikelihood * residualImpact >= 9
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  {residualLikelihood * residualImpact}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("riskEval.decision")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(["accept", "mitigate", "transfer", "avoid"] as const).map(
                    (d) => (
                      <button
                        key={d}
                        onClick={() => setRiskDecision(d)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          riskDecision === d
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {t(`riskEval.decisions.${d}`)}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("riskEval.justification")}
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                  value={riskJustification}
                  onChange={(e) => setRiskJustification(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep("controls")}
            >
              <ChevronLeft size={14} className="mr-1" /> {t("assessment.back")}
            </Button>
            {riskScenarios.length > 0 && (
              <Button size="sm" onClick={submitRiskEval}>
                {t("evaluation.saveAndNext")}{" "}
                <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
