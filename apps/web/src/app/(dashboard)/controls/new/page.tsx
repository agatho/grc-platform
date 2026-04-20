"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ControlType,
  ControlFrequency,
  AutomationLevel,
  ControlAssertion,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPES: ControlType[] = ["preventive", "detective", "corrective"];
const FREQUENCIES: ControlFrequency[] = [
  "event_driven",
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
  "ad_hoc",
];
const AUTOMATION_LEVELS: AutomationLevel[] = [
  "manual",
  "semi_automated",
  "fully_automated",
];
const LOD_OPTIONS = ["first", "second", "third"] as const;
const ASSERTIONS: ControlAssertion[] = [
  "completeness",
  "accuracy",
  "obligations_and_rights",
  "fraud_prevention",
  "existence",
  "valuation",
  "presentation",
  "safeguarding_of_assets",
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CreateControlPage() {
  return (
    <ModuleGate moduleKey="ics">
      <CreateControlInner />
    </ModuleGate>
  );
}

interface BudgetOption {
  id: string;
  name: string;
  budgetType: string;
  grcArea: string | null;
  totalAmount: string;
  currency: string;
  status: string;
}

function CreateControlInner() {
  const t = useTranslations("controls");
  const tActions = useTranslations("actions");
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    controlType: "preventive" as ControlType,
    frequency: "monthly" as ControlFrequency,
    automationLevel: "manual" as AutomationLevel,
    lineOfDefense: "first" as string,
    ownerId: "",
    assertions: [] as string[],
    costOnetime: "",
    costAnnual: "",
    effortHours: "",
    budgetId: "",
    costNote: "",
  });

  useEffect(() => {
    fetch("/api/v1/budgets?limit=100")
      .then((r) => r.json())
      .then((json) => setBudgets(json.data ?? []))
      .catch(() => {});
  }, []);

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAssertion = (assertion: string) => {
    setForm((prev) => ({
      ...prev,
      assertions: prev.assertions.includes(assertion)
        ? prev.assertions.filter((a) => a !== assertion)
        : [...prev.assertions, assertion],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error(t("form.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        costOnetime: form.costOnetime
          ? parseFloat(form.costOnetime)
          : undefined,
        costAnnual: form.costAnnual ? parseFloat(form.costAnnual) : undefined,
        effortHours: form.effortHours
          ? parseFloat(form.effortHours)
          : undefined,
        budgetId: form.budgetId || undefined,
      };
      const res = await fetch("/api/v1/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create control");
      const json = await res.json();
      toast.success(t("created"));
      router.push(`/controls/${json.data?.id ?? ""}`);
    } catch {
      toast.error(t("createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/controls")}
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("create")}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("form.title")}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder={t("form.titlePlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("form.description")}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                rows={4}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Type / Frequency / Automation row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("form.type")}
                </label>
                <Select
                  value={form.controlType}
                  onValueChange={(v) =>
                    updateField("controlType", v as ControlType)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tt) => (
                      <SelectItem key={tt} value={tt}>
                        {t(`type.${tt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("form.frequency")}
                </label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    updateField("frequency", v as ControlFrequency)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(`frequency.${f}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("form.automation")}
                </label>
                <Select
                  value={form.automationLevel}
                  onValueChange={(v) =>
                    updateField("automationLevel", v as AutomationLevel)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_LEVELS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`automation.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* LoD */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("form.lod")}
              </label>
              <Select
                value={form.lineOfDefense}
                onValueChange={(v) => updateField("lineOfDefense", v)}
              >
                <SelectTrigger className="mt-1 w-full md:w-1/3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOD_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(`lod.${l}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Owner */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("form.owner")}
              </label>
              <input
                type="text"
                value={form.ownerId}
                onChange={(e) => updateField("ownerId", e.target.value)}
                placeholder={t("form.ownerPlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Assertions multi-select */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {t("assertions.title")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASSERTIONS.map((assertion) => (
                  <div key={assertion} className="flex items-center gap-2">
                    <Checkbox
                      id={`assertion-${assertion}`}
                      checked={form.assertions.includes(assertion)}
                      onCheckedChange={() => toggleAssertion(assertion)}
                    />
                    <label
                      htmlFor={`assertion-${assertion}`}
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      {t(`assertions.${assertion}`)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Tracking */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t("costTracking.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("costTracking.costOnetime")}
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costOnetime}
                    onChange={(e) => updateField("costOnetime", e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    EUR
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("costTracking.costAnnual")}
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costAnnual}
                    onChange={(e) => updateField("costAnnual", e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    EUR
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("costTracking.effortHours")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.effortHours}
                  onChange={(e) => updateField("effortHours", e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("costTracking.budget")}
              </label>
              <Select
                value={form.budgetId}
                onValueChange={(v) => updateField("budgetId", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={t("costTracking.budgetPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.currency}{" "}
                      {parseFloat(b.totalAmount).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("costTracking.costNote")}
              </label>
              <textarea
                value={form.costNote}
                onChange={(e) => updateField("costNote", e.target.value)}
                placeholder={t("costTracking.costNotePlaceholder")}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/controls")}
          >
            {tActions("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            {tActions("create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
