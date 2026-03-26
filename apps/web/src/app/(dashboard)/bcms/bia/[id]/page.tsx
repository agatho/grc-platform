"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ChevronRight, ChevronLeft, Check } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BiaAssessment, BiaProcessImpact } from "@grc/shared";

export default function BiaWizardPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <BiaWizardInner />
    </ModuleGate>
  );
}

function BiaWizardInner() {
  const t = useTranslations("bcms");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assessment, setAssessment] = useState<BiaAssessment | null>(null);
  const [impacts, setImpacts] = useState<BiaProcessImpact[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Current impact form state
  const [form, setForm] = useState({
    processId: "",
    mtpdHours: undefined as number | undefined,
    rtoHours: undefined as number | undefined,
    rpoHours: undefined as number | undefined,
    impact1h: undefined as number | undefined,
    impact4h: undefined as number | undefined,
    impact24h: undefined as number | undefined,
    impact72h: undefined as number | undefined,
    impact1w: undefined as number | undefined,
    impact1m: undefined as number | undefined,
    impactReputation: undefined as number | undefined,
    impactLegal: undefined as number | undefined,
    impactOperational: undefined as number | undefined,
    impactFinancial: undefined as number | undefined,
    impactSafety: undefined as number | undefined,
    criticalResources: "",
    minimumStaff: undefined as number | undefined,
    alternateLocation: "",
    peakPeriods: "",
    isEssential: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, iRes] = await Promise.all([
        fetch(`/api/v1/bcms/bia/${id}`),
        fetch(`/api/v1/bcms/bia/${id}/impacts?limit=100`),
      ]);
      if (aRes.ok) {
        const json = await aRes.json();
        setAssessment(json.data);
      }
      if (iRes.ok) {
        const json = await iRes.json();
        setImpacts(json.data ?? []);
        if (json.data?.length > 0) {
          loadImpact(json.data[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const loadImpact = (imp: BiaProcessImpact) => {
    setForm({
      processId: imp.processId,
      mtpdHours: imp.mtpdHours ?? undefined,
      rtoHours: imp.rtoHours ?? undefined,
      rpoHours: imp.rpoHours ?? undefined,
      impact1h: imp.impact1h ? parseFloat(imp.impact1h) : undefined,
      impact4h: imp.impact4h ? parseFloat(imp.impact4h) : undefined,
      impact24h: imp.impact24h ? parseFloat(imp.impact24h) : undefined,
      impact72h: imp.impact72h ? parseFloat(imp.impact72h) : undefined,
      impact1w: imp.impact1w ? parseFloat(imp.impact1w) : undefined,
      impact1m: imp.impact1m ? parseFloat(imp.impact1m) : undefined,
      impactReputation: imp.impactReputation ?? undefined,
      impactLegal: imp.impactLegal ?? undefined,
      impactOperational: imp.impactOperational ?? undefined,
      impactFinancial: imp.impactFinancial ?? undefined,
      impactSafety: imp.impactSafety ?? undefined,
      criticalResources: imp.criticalResources ?? "",
      minimumStaff: imp.minimumStaff ?? undefined,
      alternateLocation: imp.alternateLocation ?? "",
      peakPeriods: imp.peakPeriods ?? "",
      isEssential: imp.isEssential,
    });
  };

  const handleSave = async () => {
    if (!form.processId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/bcms/bia/${id}/impacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        // Advance to next
        if (currentIndex < impacts.length - 1) {
          const nextIdx = currentIndex + 1;
          setCurrentIndex(nextIdx);
          loadImpact(impacts[nextIdx]);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !assessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!assessment) {
    return <p className="text-center text-gray-400 py-12">{t("bia.notFound")}</p>;
  }

  const assessedCount = impacts.filter((i) => i.rtoHours != null).length;
  const totalCount = impacts.length;
  const progressPct = totalCount > 0 ? Math.round((assessedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/bcms/bia")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{assessment.name}</h1>
          <p className="text-sm text-gray-500">
            {t("bia.progress")}: {assessedCount}/{totalCount} {t("bia.processCount")} ({progressPct}%)
          </p>
        </div>
        <Badge variant="outline" className={`${form.isEssential ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
          {form.isEssential ? "Essential" : "Standard"}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Process Stepper */}
      {impacts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {impacts.map((imp, idx) => (
            <button
              key={imp.id}
              onClick={() => { setCurrentIndex(idx); loadImpact(imp); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                idx === currentIndex
                  ? "bg-blue-600 text-white"
                  : imp.rtoHours != null
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {imp.rtoHours != null && idx !== currentIndex && <Check size={10} className="inline mr-1" />}
              {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Recovery Targets */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("bia.recoveryTargets")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput label={t("bia.mtpd")} value={form.mtpdHours} onChange={(v) => setForm({ ...form, mtpdHours: v })} suffix={t("bia.hours")} />
          <NumberInput label={t("bia.rto")} value={form.rtoHours} onChange={(v) => setForm({ ...form, rtoHours: v })} suffix={t("bia.hours")} />
          <NumberInput label={t("bia.rpo")} value={form.rpoHours} onChange={(v) => setForm({ ...form, rpoHours: v })} suffix={t("bia.hours")} />
        </div>
        {form.rtoHours != null && form.mtpdHours != null && form.rtoHours <= form.mtpdHours && (
          <p className="text-xs text-green-600 mt-2">RTO ({form.rtoHours}h) &le; MTPD ({form.mtpdHours}h)</p>
        )}
        {form.rtoHours != null && form.mtpdHours != null && form.rtoHours > form.mtpdHours && (
          <p className="text-xs text-red-600 mt-2">RTO ({form.rtoHours}h) must be &le; MTPD ({form.mtpdHours}h)</p>
        )}
      </div>

      {/* Financial Impact */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("bia.financialImpact")} (EUR)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberInput label={t("bia.after1h")} value={form.impact1h} onChange={(v) => setForm({ ...form, impact1h: v })} />
          <NumberInput label={t("bia.after4h")} value={form.impact4h} onChange={(v) => setForm({ ...form, impact4h: v })} />
          <NumberInput label={t("bia.after24h")} value={form.impact24h} onChange={(v) => setForm({ ...form, impact24h: v })} />
          <NumberInput label={t("bia.after72h")} value={form.impact72h} onChange={(v) => setForm({ ...form, impact72h: v })} />
          <NumberInput label={t("bia.after1w")} value={form.impact1w} onChange={(v) => setForm({ ...form, impact1w: v })} />
          <NumberInput label={t("bia.after1m")} value={form.impact1m} onChange={(v) => setForm({ ...form, impact1m: v })} />
        </div>

        {/* Simple bar chart */}
        <div className="mt-4 space-y-1">
          {([
            { label: "1h", val: form.impact1h },
            { label: "4h", val: form.impact4h },
            { label: "24h", val: form.impact24h },
            { label: "72h", val: form.impact72h },
            { label: "1w", val: form.impact1w },
            { label: "1m", val: form.impact1m },
          ] as const).map(({ label, val }) => {
            const maxVal = Math.max(form.impact1m ?? 0, form.impact1w ?? 0, form.impact72h ?? 0, 1);
            const pct = val ? Math.round((val / maxVal) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8">{label}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded">
                  <div className="h-full bg-blue-400 rounded transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-600 w-24 text-right">
                  {val != null ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val) : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Qualitative Impact */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("bia.qualitativeImpact")} (1-5)</h2>
        <div className="space-y-3">
          {([
            { key: "impactReputation", label: t("bia.reputation") },
            { key: "impactLegal", label: t("bia.legal") },
            { key: "impactOperational", label: t("bia.operational") },
            { key: "impactFinancial", label: t("bia.financial") },
            { key: "impactSafety", label: t("bia.safety") },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-28">{label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, [key]: n })}
                    className={`w-8 h-8 rounded-full text-sm font-medium border transition-colors ${
                      form[key] === n
                        ? n >= 4
                          ? "bg-red-500 text-white border-red-500"
                          : n >= 3
                            ? "bg-yellow-500 text-white border-yellow-500"
                            : "bg-green-500 text-white border-green-500"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("bia.dependencies")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("bia.criticalResources")}</label>
            <input
              type="text"
              value={form.criticalResources}
              onChange={(e) => setForm({ ...form, criticalResources: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <NumberInput label={t("bia.minimumStaff")} value={form.minimumStaff} onChange={(v) => setForm({ ...form, minimumStaff: v })} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("bia.alternateLocation")}</label>
            <input
              type="text"
              value={form.alternateLocation}
              onChange={(e) => setForm({ ...form, alternateLocation: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("bia.peakPeriods")}</label>
            <input
              type="text"
              value={form.peakPeriods}
              onChange={(e) => setForm({ ...form, peakPeriods: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Essential checkbox + Nav */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isEssential}
            onChange={(e) => setForm({ ...form, isEssential: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">{t("bia.markEssential")}</span>
        </label>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => {
              const prevIdx = currentIndex - 1;
              setCurrentIndex(prevIdx);
              loadImpact(impacts[prevIdx]);
            }}
          >
            <ChevronLeft size={14} className="mr-1" /> {t("bia.back")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {t("bia.saveAndNext")} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {suffix && <span className="text-xs text-gray-500 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}
