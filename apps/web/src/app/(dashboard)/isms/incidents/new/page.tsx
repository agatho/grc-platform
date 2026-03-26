"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import type { IncidentSeverity } from "@grc/shared";

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];

export default function CreateIncidentPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CreateIncidentInner />
    </ModuleGate>
  );
}

function CreateIncidentInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [incidentType, setIncidentType] = useState("");
  const [isDataBreach, setIsDataBreach] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/isms/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          severity,
          incidentType: incidentType || undefined,
          isDataBreach,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(t("incidentCreated"));
        router.push(`/isms/incidents/${json.data.id}`);
      } else {
        toast.error(t("createError"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/isms/incidents")} className="mb-2">
          <ArrowLeft size={14} className="mr-1" /> {t("backToIncidents")}
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("createIncident")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("titleField")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={t("incidentTitlePlaceholder")}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("severity")}</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{t(`incidentSeverity.${s}`)}</option>
            ))}
          </select>
        </div>

        {/* Incident Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("incidentTypeField")}</label>
          <input
            type="text"
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            placeholder="e.g. malware, phishing, data_loss"
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={t("incidentDescriptionPlaceholder")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Data Breach Toggle */}
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
          <input
            type="checkbox"
            id="isDataBreach"
            checked={isDataBreach}
            onChange={(e) => setIsDataBreach(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <label htmlFor="isDataBreach" className="text-sm font-medium text-gray-900 cursor-pointer">
              {t("dataBreach")}
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              {t("dataBreachDescription")}
            </p>
          </div>
        </div>

        {isDataBreach && (
          <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">{t("breach72h")}</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {t("breachDeadline")}
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            {t("createIncident")}
          </Button>
        </div>
      </form>
    </div>
  );
}
