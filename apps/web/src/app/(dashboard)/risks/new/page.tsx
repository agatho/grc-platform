"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { RiskScoreBadge } from "@/components/risk/risk-score-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@grc/ui";
import type {
  RiskCategory,
  RiskSource,
  TreatmentStrategy,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  // Step 1
  title: string;
  description: string;
  riskCategory: RiskCategory | "";
  riskSource: RiskSource | "";
  ownerId: string;
  department: string;
  reviewDate: string;
  // Step 2
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  // Step 3
  treatmentStrategy: TreatmentStrategy | "";
  treatmentRationale: string;
  // Catalog reference (optional, set when creating from catalog)
  catalogEntryId?: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  riskCategory: "",
  riskSource: "",
  ownerId: "",
  department: "",
  reviewDate: "",
  inherentLikelihood: null,
  inherentImpact: null,
  residualLikelihood: null,
  residualImpact: null,
  treatmentStrategy: "",
  treatmentRationale: "",
};

const CATEGORIES: RiskCategory[] = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
];

const SOURCES: RiskSource[] = ["isms", "erm", "bcm", "project", "process"];

const STRATEGIES: TreatmentStrategy[] = [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
];

const LEVELS = [1, 2, 3, 4, 5] as const;

const LEVEL_KEYS = ["veryLow", "low", "medium", "high", "veryHigh"] as const;

// ---------------------------------------------------------------------------
// Score color for mini heat map
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score <= 4) return "#27AE60";
  if (score <= 8) return "#F1C40F";
  if (score <= 14) return "#E67E22";
  if (score <= 19) return "#E74C3C";
  return "#8E44AD";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NewRiskPage() {
  return (
    <ModuleGate moduleKey="erm">
      <NewRiskForm />
    </ModuleGate>
  );
}

function NewRiskForm() {
  const t = useTranslations("risk");
  const tActions = useTranslations("actions");
  const router = useRouter();

  // Pre-fill from catalog entry query params
  const searchParams = useSearchParams();
  const catalogEntryId = searchParams.get("catalogEntryId");
  const catalogName = searchParams.get("catalogName");
  const catalogCode = searchParams.get("catalogCode");

  const initialForm = useMemo<FormData>(() => {
    if (catalogName) {
      return { ...EMPTY_FORM, title: catalogName, catalogEntryId: catalogEntryId ?? undefined } as FormData;
    }
    return EMPTY_FORM;
  }, [catalogName, catalogEntryId]);

  const [form, setForm] = useState<FormData>(initialForm);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);

  // Fetch users for owner picker
  useEffect(() => {
    fetch("/api/v1/users?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((json) => {
        const users = (json.data ?? []).map(
          (u: Record<string, unknown>) => ({
            id: u.id as string,
            name: (u.name as string) || (u.email as string),
            email: u.email as string,
          }),
        );
        setOrgUsers(users);
      })
      .catch(() => {});
  }, []);

  // Computed scores
  const inherentScore = useMemo(() => {
    if (form.inherentLikelihood && form.inherentImpact) {
      return form.inherentLikelihood * form.inherentImpact;
    }
    return null;
  }, [form.inherentLikelihood, form.inherentImpact]);

  const residualScore = useMemo(() => {
    if (form.residualLikelihood && form.residualImpact) {
      return form.residualLikelihood * form.residualImpact;
    }
    return null;
  }, [form.residualLikelihood, form.residualImpact]);

  // Step validation
  const isStep1Valid =
    form.title.trim().length > 0 &&
    form.riskCategory !== "" &&
    form.riskSource !== "";

  const isStep2Valid =
    form.inherentLikelihood !== null && form.inherentImpact !== null;

  const isStep3Valid =
    form.treatmentStrategy !== "" &&
    (form.treatmentStrategy !== "accept" ||
      form.treatmentRationale.trim().length >= 50);

  // Update helper
  const update = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Submit
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        riskCategory: form.riskCategory,
        riskSource: form.riskSource,
      };
      if (form.description.trim())
        payload.description = form.description.trim();
      if (form.ownerId) payload.ownerId = form.ownerId;
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.reviewDate) payload.reviewDate = form.reviewDate;
      if (form.inherentLikelihood)
        payload.inherentLikelihood = form.inherentLikelihood;
      if (form.inherentImpact) payload.inherentImpact = form.inherentImpact;
      if (form.residualLikelihood)
        payload.residualLikelihood = form.residualLikelihood;
      if (form.residualImpact) payload.residualImpact = form.residualImpact;
      if (form.treatmentStrategy)
        payload.treatmentStrategy = form.treatmentStrategy;
      if (form.treatmentRationale.trim())
        payload.treatmentRationale = form.treatmentRationale.trim();
      if (form.catalogEntryId) payload.catalogEntryId = form.catalogEntryId;

      const res = await fetch("/api/v1/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          (errJson as Record<string, string>).error ?? "Create failed",
        );
      }

      const json = await res.json();
      const riskId = json.data?.id;

      toast.success(t("form.created"));
      router.push(riskId ? `/risks/${riskId}` : "/risks");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("form.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!form.title.trim()) {
      toast.error(t("form.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        riskCategory: form.riskCategory || "operational",
        riskSource: form.riskSource || "erm",
      };
      if (form.description.trim())
        payload.description = form.description.trim();
      if (form.ownerId) payload.ownerId = form.ownerId;
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.reviewDate) payload.reviewDate = form.reviewDate;
      if (form.inherentLikelihood)
        payload.inherentLikelihood = form.inherentLikelihood;
      if (form.inherentImpact) payload.inherentImpact = form.inherentImpact;
      if (form.residualLikelihood)
        payload.residualLikelihood = form.residualLikelihood;
      if (form.residualImpact) payload.residualImpact = form.residualImpact;
      if (form.catalogEntryId) payload.catalogEntryId = form.catalogEntryId;

      const res = await fetch("/api/v1/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Draft save failed");

      const json = await res.json();
      toast.success(t("form.draftSaved"));
      router.push(json.data?.id ? `/risks/${json.data.id}` : "/risks");
    } catch {
      toast.error(t("form.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { label: t("form.step1"), valid: isStep1Valid },
    { label: t("form.step2"), valid: isStep2Valid },
    { label: t("form.step3"), valid: isStep3Valid },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/risks"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {t("backToList")}
      </Link>

      {/* Catalog source banner */}
      {catalogCode && catalogName && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <BookOpen size={18} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Aus Katalog: <span className="font-mono">{catalogCode}</span> — {catalogName}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">Titel und Beschreibung wurden vorausgefüllt</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("create")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("form.createDescription")}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isComplete = step > stepNum;
          return (
            <div key={stepNum} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={cn(
                    "h-px w-8",
                    isComplete ? "bg-emerald-500" : "bg-gray-200",
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (isComplete || stepNum <= step) setStep(stepNum);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive &&
                    "bg-slate-900 text-white",
                  isComplete &&
                    "bg-emerald-100 text-emerald-800",
                  !isActive &&
                    !isComplete &&
                    "bg-gray-100 text-gray-400",
                )}
              >
                {isComplete ? (
                  <Check size={14} />
                ) : (
                  <span className="font-bold">{stepNum}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Form Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {/* Step 1: Basic Data */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("form.step1")}
            </h2>

            <div className="space-y-2">
              <Label htmlFor="risk-title">{t("form.titleField")} *</Label>
              <Input
                id="risk-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
                maxLength={255}
                placeholder={t("form.titlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-desc">{t("form.description")}</Label>
              <Textarea
                id="risk-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={4}
                placeholder={t("form.descriptionPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="risk-category">
                  {t("form.category")} *
                </Label>
                <Select
                  value={form.riskCategory || undefined}
                  onValueChange={(v) =>
                    update("riskCategory", v as RiskCategory)
                  }
                >
                  <SelectTrigger id="risk-category">
                    <SelectValue placeholder={t("form.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-source">{t("form.source")} *</Label>
                <Select
                  value={form.riskSource || undefined}
                  onValueChange={(v) =>
                    update("riskSource", v as RiskSource)
                  }
                >
                  <SelectTrigger id="risk-source">
                    <SelectValue placeholder={t("form.selectSource")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`source.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="risk-owner">{t("form.owner")}</Label>
                <Select
                  value={form.ownerId || "__none__"}
                  onValueChange={(v) =>
                    update("ownerId", v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger id="risk-owner">
                    <SelectValue placeholder={t("form.selectOwner")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("form.noOwner")}
                    </SelectItem>
                    {orgUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-dept">{t("form.department")}</Label>
                <Input
                  id="risk-dept"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                  placeholder={t("form.departmentPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label htmlFor="risk-review">{t("form.reviewDate")}</Label>
              <Input
                id="risk-review"
                type="date"
                value={form.reviewDate}
                onChange={(e) => update("reviewDate", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Assessment */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("form.step2")}
            </h2>

            {/* Inherent Assessment */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {t("heatmap.inherent")}
              </h3>

              <div className="space-y-3">
                <Label>{t("form.likelihood")} *</Label>
                <div className="flex gap-2">
                  {LEVELS.map((level, idx) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => update("inherentLikelihood", level)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-all text-center min-w-[64px]",
                        form.inherentLikelihood === level
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <span className="text-lg font-bold text-gray-800">
                        {level}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        {t(`likelihood.${LEVEL_KEYS[idx]}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t("form.impact")} *</Label>
                <div className="flex gap-2">
                  {LEVELS.map((level, idx) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => update("inherentImpact", level)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-all text-center min-w-[64px]",
                        form.inherentImpact === level
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <span className="text-lg font-bold text-gray-800">
                        {level}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        {t(`impact.${LEVEL_KEYS[idx]}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini heat map + score badge */}
              {inherentScore !== null && (
                <div className="flex items-center gap-4 pt-2">
                  <MiniHeatMap
                    likelihood={form.inherentLikelihood!}
                    impact={form.inherentImpact!}
                    t={t}
                  />
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {t("form.inherentScore")}
                    </span>
                    <RiskScoreBadge score={inherentScore} size="lg" />
                  </div>
                </div>
              )}
            </div>

            {/* Residual Assessment (optional) */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {t("heatmap.residual")}{" "}
                <span className="font-normal text-gray-400 lowercase">
                  ({t("form.optional")})
                </span>
              </h3>

              <div className="space-y-3">
                <Label>{t("form.likelihood")}</Label>
                <div className="flex gap-2">
                  {LEVELS.map((level, idx) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        update(
                          "residualLikelihood",
                          form.residualLikelihood === level ? null : level,
                        )
                      }
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-all text-center min-w-[64px]",
                        form.residualLikelihood === level
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <span className="text-lg font-bold text-gray-800">
                        {level}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        {t(`likelihood.${LEVEL_KEYS[idx]}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t("form.impact")}</Label>
                <div className="flex gap-2">
                  {LEVELS.map((level, idx) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        update(
                          "residualImpact",
                          form.residualImpact === level ? null : level,
                        )
                      }
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-all text-center min-w-[64px]",
                        form.residualImpact === level
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <span className="text-lg font-bold text-gray-800">
                        {level}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        {t(`impact.${LEVEL_KEYS[idx]}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {residualScore !== null && (
                <div className="flex items-center gap-4 pt-2">
                  <MiniHeatMap
                    likelihood={form.residualLikelihood!}
                    impact={form.residualImpact!}
                    t={t}
                  />
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {t("form.residualScore")}
                    </span>
                    <RiskScoreBadge score={residualScore} size="lg" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Treatment */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("form.step3")}
            </h2>

            <div className="space-y-3">
              <Label>{t("form.strategy")} *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STRATEGIES.map((strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() => update("treatmentStrategy", strategy)}
                    className={cn(
                      "rounded-lg border-2 p-4 text-left transition-all",
                      form.treatmentStrategy === strategy
                        ? "border-slate-900 bg-slate-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                          form.treatmentStrategy === strategy
                            ? "border-slate-900"
                            : "border-gray-300",
                        )}
                      >
                        {form.treatmentStrategy === strategy && (
                          <div className="h-2 w-2 rounded-full bg-slate-900" />
                        )}
                      </div>
                      <span className="font-semibold text-sm text-gray-900">
                        {t(`treatment.${strategy}`)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">
                      {t(`treatment.${strategy}Description`)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Rationale (required if Accept) */}
            <div className="space-y-2">
              <Label htmlFor="risk-rationale">
                {t("form.rationale")}
                {form.treatmentStrategy === "accept" && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <Textarea
                id="risk-rationale"
                value={form.treatmentRationale}
                onChange={(e) =>
                  update("treatmentRationale", e.target.value)
                }
                rows={4}
                placeholder={t("form.rationalePlaceholder")}
                className={cn(
                  form.treatmentStrategy === "accept" &&
                    form.treatmentRationale.trim().length > 0 &&
                    form.treatmentRationale.trim().length < 50 &&
                    "border-red-300 focus:border-red-500 focus:ring-red-500",
                )}
              />
              {form.treatmentStrategy === "accept" && (
                <p
                  className={cn(
                    "text-xs",
                    form.treatmentRationale.trim().length < 50
                      ? "text-red-500"
                      : "text-gray-400",
                  )}
                >
                  {t("form.rationaleMinChars", {
                    count: form.treatmentRationale.trim().length,
                    min: 50,
                  })}
                </p>
              )}
            </div>

            {/* Summary preview */}
            {inherentScore !== null && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">
                  {t("form.summary")}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">
                      {t("heatmap.inherent")}:
                    </span>{" "}
                    <RiskScoreBadge score={inherentScore} size="sm" />
                  </div>
                  {residualScore !== null && (
                    <div>
                      <span className="text-gray-500">
                        {t("heatmap.residual")}:
                      </span>{" "}
                      <RiskScoreBadge score={residualScore} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={saving}
            >
              <ChevronLeft size={16} />
              {t("form.back")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save Draft */}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || !form.title.trim()}
          >
            <Save size={14} />
            {t("form.saveDraft")}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !isStep1Valid) ||
                (step === 2 && !isStep2Valid)
              }
            >
              {t("form.next")}
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                saving || !isStep1Valid || !isStep2Valid || !isStep3Valid
              }
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {t("form.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini 5x5 Heat Map Preview
// ---------------------------------------------------------------------------

function MiniHeatMap({
  likelihood,
  impact,
  t,
}: {
  likelihood: number;
  impact: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col-reverse gap-px">
      {LEVELS.map((l) => (
        <div key={l} className="flex gap-px">
          {LEVELS.map((i) => {
            const score = l * i;
            const isSelected = l === likelihood && i === impact;
            return (
              <div
                key={`${l}-${i}`}
                className={cn(
                  "h-5 w-5 rounded-[2px] transition-all",
                  isSelected && "ring-2 ring-slate-800 ring-offset-1 z-10",
                )}
                style={{
                  backgroundColor: getScoreColor(score),
                  opacity: isSelected ? 1 : 0.35,
                }}
                title={`L${l} x I${i} = ${score}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
