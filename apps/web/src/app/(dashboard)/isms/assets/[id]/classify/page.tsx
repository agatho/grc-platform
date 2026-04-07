"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { ProtectionLevelBadge } from "@/components/isms/protection-level-badge";
import { Button } from "@/components/ui/button";
import type { ProtectionLevel } from "@grc/shared";

const LEVELS: ProtectionLevel[] = ["normal", "high", "very_high"];

const LEVEL_COLORS: Record<ProtectionLevel, string> = {
  normal: "border-green-400 bg-green-50 ring-green-400",
  high: "border-orange-400 bg-orange-50 ring-orange-400",
  very_high: "border-red-400 bg-red-50 ring-red-400",
};

function computeOverall(c: ProtectionLevel, i: ProtectionLevel, a: ProtectionLevel): ProtectionLevel {
  if (c === "very_high" || i === "very_high" || a === "very_high") return "very_high";
  if (c === "high" || i === "high" || a === "high") return "high";
  return "normal";
}

interface ClassificationState {
  confidentialityLevel: ProtectionLevel;
  confidentialityReason: string;
  integrityLevel: ProtectionLevel;
  integrityReason: string;
  availabilityLevel: ProtectionLevel;
  availabilityReason: string;
  reviewDate: string;
}

export default function ClassifyAssetPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ClassifyInner />
    </ModuleGate>
  );
}

function ClassifyInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;

  const [step, setStep] = useState(0); // 0=C, 1=I, 2=A, 3=Summary
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [form, setForm] = useState<ClassificationState>({
    confidentialityLevel: "normal",
    confidentialityReason: "",
    integrityLevel: "normal",
    integrityReason: "",
    availabilityLevel: "normal",
    availabilityReason: "",
    reviewDate: "",
  });

  // Load existing classification
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [classRes, assetRes] = await Promise.all([
          fetch(`/api/v1/isms/assets/${assetId}/classification`),
          fetch(`/api/v1/assets/${assetId}`),
        ]);

        if (assetRes.ok) {
          const assetJson = await assetRes.json();
          setAssetName(assetJson.data?.name ?? "");
        }

        if (classRes.ok) {
          const classJson = await classRes.json();
          if (classJson.data) {
            setForm({
              confidentialityLevel: classJson.data.confidentialityLevel ?? "normal",
              confidentialityReason: classJson.data.confidentialityReason ?? "",
              integrityLevel: classJson.data.integrityLevel ?? "normal",
              integrityReason: classJson.data.integrityReason ?? "",
              availabilityLevel: classJson.data.availabilityLevel ?? "normal",
              availabilityReason: classJson.data.availabilityReason ?? "",
              reviewDate: classJson.data.reviewDate ?? "",
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [assetId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/isms/assets/${assetId}/classification`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidentialityLevel: form.confidentialityLevel,
          confidentialityReason: form.confidentialityReason || undefined,
          integrityLevel: form.integrityLevel,
          integrityReason: form.integrityReason || undefined,
          availabilityLevel: form.availabilityLevel,
          availabilityReason: form.availabilityReason || undefined,
          reviewDate: form.reviewDate || undefined,
        }),
      });

      if (res.ok) {
        toast.success(t("classificationSaved"));
        router.push("/isms/assets");
      } else {
        toast.error(t("classificationError"));
      }
    } finally {
      setSaving(false);
    }
  }, [assetId, form, router, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const overall = computeOverall(
    form.confidentialityLevel,
    form.integrityLevel,
    form.availabilityLevel,
  );

  const steps = [
    { key: "confidentiality" as const, label: t("confidentiality") },
    { key: "integrity" as const, label: t("integrity") },
    { key: "availability" as const, label: t("availability") },
    { key: "summary" as const, label: t("summary") },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/isms/assets")} className="mb-2">
          <ArrowLeft size={14} className="mr-1" /> {t("backToAssets")}
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("classify")}: {assetName}
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === step
                ? "bg-blue-600 text-white"
                : i < step
                  ? "bg-blue-100 text-blue-900"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {i < step ? <Check size={12} /> : <span>{i + 1}</span>}
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {step === 0 && (
          <CiaStep
            dimension="confidentiality"
            label={t("confidentiality")}
            description={t("impactDisclosure")}
            level={form.confidentialityLevel}
            reason={form.confidentialityReason}
            onLevelChange={(v) => setForm({ ...form, confidentialityLevel: v })}
            onReasonChange={(v) => setForm({ ...form, confidentialityReason: v })}
            t={t}
          />
        )}
        {step === 1 && (
          <CiaStep
            dimension="integrity"
            label={t("integrity")}
            description={t("impactCorruption")}
            level={form.integrityLevel}
            reason={form.integrityReason}
            onLevelChange={(v) => setForm({ ...form, integrityLevel: v })}
            onReasonChange={(v) => setForm({ ...form, integrityReason: v })}
            t={t}
          />
        )}
        {step === 2 && (
          <CiaStep
            dimension="availability"
            label={t("availability")}
            description={t("impactOutage")}
            level={form.availabilityLevel}
            reason={form.availabilityReason}
            onLevelChange={(v) => setForm({ ...form, availabilityLevel: v })}
            onReasonChange={(v) => setForm({ ...form, availabilityReason: v })}
            t={t}
          />
        )}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t("summary")}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">{t("confidentiality")}</p>
                <ProtectionLevelBadge level={form.confidentialityLevel} className="text-sm" />
              </div>
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">{t("integrity")}</p>
                <ProtectionLevelBadge level={form.integrityLevel} className="text-sm" />
              </div>
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">{t("availability")}</p>
                <ProtectionLevelBadge level={form.availabilityLevel} className="text-sm" />
              </div>
            </div>
            <div className="rounded-lg border-2 border-gray-300 p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">{t("overallProtection")} ({t("maximumPrinciple")})</p>
              <ProtectionLevelBadge level={overall} className="text-lg px-4 py-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("nextReview")}</label>
              <input
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={14} className="mr-1" /> {t("previous")}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>
            {t("next")} <ArrowRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            {t("saveClassification")}
          </Button>
        )}
      </div>
    </div>
  );
}

function CiaStep({
  dimension,
  label,
  description,
  level,
  reason,
  onLevelChange,
  onReasonChange,
  t,
}: {
  dimension: string;
  label: string;
  description: string;
  level: ProtectionLevel;
  reason: string;
  onLevelChange: (v: ProtectionLevel) => void;
  onReasonChange: (v: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
      <p className="text-sm text-gray-600">{description}</p>
      <div className="space-y-2">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onLevelChange(l)}
            className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
              level === l
                ? `${LEVEL_COLORS[l]} ring-2`
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  level === l ? "border-blue-600" : "border-gray-300"
                }`}
              >
                {level === l && <div className="h-2 w-2 rounded-full bg-blue-600" />}
              </div>
              <ProtectionLevelBadge level={l} />
              <span className="text-sm text-gray-600">
                {l === "normal" && t("normalDescription")}
                {l === "high" && t("highDescription")}
                {l === "very_high" && t("veryHighDescription")}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("justification")}
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          placeholder={t("justificationPlaceholder")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
