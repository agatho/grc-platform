"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft, ChevronRight, Check, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CampaignFormData {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  frequency: "quarterly" | "semi_annual" | "annual";
  targetScope: {
    departments: string[];
    roles: string[];
  };
  cesWeight: number;
  reminderDaysBefore: number;
}

const STEPS = ["basics", "scope", "config", "review"] as const;

export default function CreateCampaignPage() {
  const t = useTranslations("rcsa");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CampaignFormData>({
    name: "",
    description: "",
    periodStart: "",
    periodEnd: "",
    frequency: "quarterly",
    targetScope: { departments: [], roles: [] },
    cesWeight: 15,
    reminderDaysBefore: 7,
  });

  const [departmentInput, setDepartmentInput] = useState("");

  const updateForm = (updates: Partial<CampaignFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const addDepartment = () => {
    if (departmentInput.trim() && !form.targetScope.departments.includes(departmentInput.trim())) {
      updateForm({
        targetScope: {
          ...form.targetScope,
          departments: [...form.targetScope.departments, departmentInput.trim()],
        },
      });
      setDepartmentInput("");
    }
  };

  const removeDepartment = (dept: string) => {
    updateForm({
      targetScope: {
        ...form.targetScope,
        departments: form.targetScope.departments.filter((d) => d !== dept),
      },
    });
  };

  const toggleRole = (role: string) => {
    const roles = form.targetScope.roles.includes(role)
      ? form.targetScope.roles.filter((r) => r !== role)
      : [...form.targetScope.roles, role];
    updateForm({ targetScope: { ...form.targetScope, roles } });
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/rcsa/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save campaign");
      }
      const data = await res.json();
      router.push(`/rcsa/campaigns/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const saveAndLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      // Create first
      const createRes = await fetch("/api/v1/rcsa/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to save campaign");
      }
      const createData = await createRes.json();
      const campaignId = createData.data.id;

      // Then launch
      const launchRes = await fetch(`/api/v1/rcsa/campaigns/${campaignId}/launch`, {
        method: "POST",
      });
      if (!launchRes.ok) {
        const data = await launchRes.json();
        throw new Error(data.error ?? "Failed to launch campaign");
      }

      router.push(`/rcsa/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLaunching(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return form.name.trim() && form.periodStart && form.periodEnd && form.periodEnd > form.periodStart;
      case 1:
        return form.targetScope.departments.length > 0 || form.targetScope.roles.length > 0;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/rcsa")} className="mb-2">
          <ChevronLeft size={14} className="mr-1" />
          {t("campaign.backToList")}
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("campaign.createTitle")}</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </button>
            <span className={`text-sm ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
              {t(`campaign.step.${s}`)}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.name")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={t("campaign.namePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.descriptionLabel")}</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.periodStart")}</label>
                <input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => updateForm({ periodStart: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.periodEnd")}</label>
                <input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => updateForm({ periodEnd: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.frequency")}</label>
              <select
                value={form.frequency}
                onChange={(e) => updateForm({ frequency: e.target.value as CampaignFormData["frequency"] })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="quarterly">{t("campaign.freq.quarterly")}</option>
                <option value="semi_annual">{t("campaign.freq.semi_annual")}</option>
                <option value="annual">{t("campaign.freq.annual")}</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.departments")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={departmentInput}
                  onChange={(e) => setDepartmentInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDepartment())}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder={t("campaign.departmentPlaceholder")}
                />
                <Button size="sm" onClick={addDepartment}>{t("common.add")}</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.targetScope.departments.map((dept) => (
                  <Badge key={dept} variant="outline" className="cursor-pointer" onClick={() => removeDepartment(dept)}>
                    {dept} x
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.roles")}</label>
              <div className="flex flex-wrap gap-2">
                {["risk_owner", "control_owner"].map((role) => (
                  <Button
                    key={role}
                    variant={form.targetScope.roles.includes(role) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                  >
                    {t(`campaign.role.${role}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("campaign.cesWeight")} ({form.cesWeight}%)
              </label>
              <input
                type="range"
                min={0}
                max={50}
                value={form.cesWeight}
                onChange={(e) => updateForm({ cesWeight: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">{t("campaign.cesWeightHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("campaign.reminderDays")}</label>
              <select
                value={form.reminderDaysBefore}
                onChange={(e) => updateForm({ reminderDaysBefore: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={3}>3 {t("common.days")}</option>
                <option value={7}>7 {t("common.days")}</option>
                <option value={14}>14 {t("common.days")}</option>
                <option value={21}>21 {t("common.days")}</option>
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">{t("campaign.reviewTitle")}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t("campaign.name")}:</span>
                <p className="font-medium">{form.name}</p>
              </div>
              <div>
                <span className="text-gray-500">{t("campaign.frequency")}:</span>
                <p className="font-medium">{t(`campaign.freq.${form.frequency}`)}</p>
              </div>
              <div>
                <span className="text-gray-500">{t("campaign.period")}:</span>
                <p className="font-medium">{form.periodStart} - {form.periodEnd}</p>
              </div>
              <div>
                <span className="text-gray-500">{t("campaign.cesWeight")}:</span>
                <p className="font-medium">{form.cesWeight}%</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">{t("campaign.scope")}:</span>
                <p className="font-medium">
                  {form.targetScope.departments.join(", ") || "-"}
                  {form.targetScope.roles.length > 0 && ` | ${form.targetScope.roles.join(", ")}`}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
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
          <ChevronLeft size={14} className="mr-1" />
          {t("common.back")}
        </Button>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              {t("common.next")}
              <ChevronRight size={14} className="ml-1" />
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={saveDraft} disabled={saving || launching}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                {t("campaign.saveDraft")}
              </Button>
              <Button onClick={saveAndLaunch} disabled={saving || launching}>
                {launching ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Rocket size={14} className="mr-1" />
                )}
                {t("campaign.launchNow")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
