"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dpia, DpiaRisk, DpiaMeasure } from "@grc/shared";

const WIZARD_STEPS = ["description", "necessity", "risks", "measures", "signOff"] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-teal-100 text-teal-700",
  pending_dpo_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function DpiaDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DpiaDetailInner />
    </ModuleGate>
  );
}

interface DpiaDetailData extends Dpia {
  risks: DpiaRisk[];
  measures: DpiaMeasure[];
  signOffName?: string;
}

function DpiaDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DpiaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<WizardStep>("description");
  const [signingOff, setSigningOff] = useState(false);

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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
                ? "bg-blue-100 text-blue-700"
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t("dpia.steps.risks")}</h2>
              <span className="text-sm text-gray-500">{data.risks.length} {t("dpia.risksCount")}</span>
            </div>
            {data.risks.length === 0 ? (
              <p className="text-sm text-gray-400">{t("dpia.noRisks")}</p>
            ) : (
              <div className="space-y-3">
                {data.risks.map((risk) => (
                  <div key={risk.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm text-gray-900">{risk.riskDescription}</p>
                    <div className="flex gap-3 mt-2">
                      <Badge variant="outline" className="text-[10px]">{t("dpia.severity")}: {risk.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t("dpia.likelihood")}: {risk.likelihood}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t("dpia.impact")}: {risk.impact}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
