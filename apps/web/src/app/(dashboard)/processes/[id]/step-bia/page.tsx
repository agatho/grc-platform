"use client";

// [ARCTOS-FULL-2026-08-31 · OP-001] Pflegemaske 4 von 4 — `process_step_bia`.
//
// MTPD, RTO und RPO in MINUTEN und je Schritt. `bia_process_impact` führt
// `mtpd_hours` je Prozess; §3.10 rechnet den Reisspunkt aber als Minimum über
// die Schritte — ohne Elementebene gäbe es nichts zu minimieren, und die Zahl
// in der Kopfzeile wäre geschätzt statt gerechnet (STUFE2-E §1.5).
//
// `workaroundMaxDurationMinutes` behandelt 0 als Wert, nicht als Leere: 0
// heisst „die Übergangslösung trägt nicht" (§7.4). Deshalb steht im
// Eingabefeld eine leere Zeichenkette für „nicht bewertet" und die Umwandlung
// benutzt `=== "" ? null : Number(...)`, nicht `Number(...) || null`.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorRetry } from "@/components/ui/error-retry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { fetchJson, ApiRequestError } from "@/lib/api-client";

const CRITICALITIES = ["very_high", "high", "medium", "low"] as const;
type Criticality = (typeof CRITICALITIES)[number];

interface BiaRow {
  criticality: string;
  mtpdMinutes: number | null;
  rtoMinutes: number | null;
  rpoMinutes: number | null;
  workaround: string | null;
  workaroundMaxDurationMinutes: number | null;
  biaAssessmentId: string | null;
}

interface StepRow {
  id: string;
  bpmnElementId: string;
  name: string | null;
  sequenceOrder: number;
  bia: BiaRow | null;
}

interface BiaResponse {
  data: StepRow[];
  meta: {
    processId: string;
    processName: string;
    coveredSteps: number;
    totalSteps: number;
    processMtpdMinutes: number | null;
  };
  options: { assessments: Array<{ id: string; name: string }> };
}

interface Draft {
  criticality: Criticality | "";
  mtpd: string;
  rto: string;
  rpo: string;
  workaround: string;
  workaroundMax: string;
  assessmentId: string;
}

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** `""` heisst „nicht bewertet", `"0"` heisst 0. Der Unterschied ist der Punkt. */
const toNumberOrNull = (v: string): number | null =>
  v.trim() === "" ? null : Number(v);

function draftOf(step: StepRow): Draft {
  return {
    criticality: (step.bia?.criticality as Criticality) ?? "",
    mtpd: num(step.bia?.mtpdMinutes),
    rto: num(step.bia?.rtoMinutes),
    rpo: num(step.bia?.rpoMinutes),
    workaround: step.bia?.workaround ?? "",
    workaroundMax: num(step.bia?.workaroundMaxDurationMinutes),
    assessmentId: step.bia?.biaAssessmentId ?? "",
  };
}

export default function StepBiaPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const t = useTranslations("processGrc");

  const [resp, setResp] = useState<BiaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<BiaResponse>(
        `/api/v1/processes/${processId}/step-bia`,
      );
      setResp(json);
      const next: Record<string, Draft> = {};
      for (const s of json.data) next[s.id] = draftOf(s);
      setDrafts(next);
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? (e.detail ?? e.message)
          : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void load();
  }, [load]);

  const criticalityLabel = (value: string) =>
    value === "very_high"
      ? t("bia.criticalityVeryHigh")
      : value === "high"
        ? t("bia.criticalityHigh")
        : value === "medium"
          ? t("bia.criticalityMedium")
          : t("bia.criticalityLow");

  const setDraft = (stepId: string, patch: Partial<Draft>) =>
    setDrafts((p) => ({ ...p, [stepId]: { ...p[stepId], ...patch } }));

  const save = async (step: StepRow) => {
    const d = drafts[step.id];
    if (!d || !d.criticality) return;
    setSavingId(step.id);
    setRowError((p) => ({ ...p, [step.id]: "" }));
    try {
      await fetchJson(`/api/v1/processes/${processId}/step-bia/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criticality: d.criticality,
          mtpdMinutes: toNumberOrNull(d.mtpd),
          rtoMinutes: toNumberOrNull(d.rto),
          rpoMinutes: toNumberOrNull(d.rpo),
          workaround: d.workaround || null,
          workaroundMaxDurationMinutes: toNumberOrNull(d.workaroundMax),
          biaAssessmentId: d.assessmentId || null,
        }),
      });
      await load();
    } catch (e) {
      setRowError((p) => ({
        ...p,
        [step.id]:
          e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
      }));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (step: StepRow) => {
    setSavingId(step.id);
    try {
      await fetchJson(`/api/v1/processes/${processId}/step-bia/${step.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      setRowError((p) => ({
        ...p,
        [step.id]:
          e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
      }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ModuleGate moduleKey="bpm">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Link
            href={`/processes/${processId}`}
            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("nav.backToProcess")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("bia.title")}</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            {t("bia.description")}
          </p>
        </div>

        {loading && !resp && (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("common.loading")}
          </p>
        )}

        {error && <ErrorRetry message={error} onRetry={load} />}

        {resp && !error && (
          <>
            <p className="text-sm text-gray-700">
              {t("bia.coverage", {
                covered: resp.meta.coveredSteps,
                total: resp.meta.totalSteps,
              })}
              {" · "}
              {resp.meta.processMtpdMinutes === null
                ? t("bia.processMtpdUnknown")
                : t("bia.processMtpd", {
                    minutes: resp.meta.processMtpdMinutes,
                  })}
            </p>

            {resp.data.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-gray-700">
                  {t("bia.empty")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {resp.data.map((step) => {
                  const d = drafts[step.id] ?? draftOf(step);
                  return (
                    <Card key={step.id}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {step.name ?? step.bpmnElementId}
                        </CardTitle>
                        <CardDescription>
                          {step.bpmnElementId}
                          {step.bia ? "" : ` · ${t("bia.notAssessed")}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <Label htmlFor={`crit-${step.id}`}>
                              {t("bia.criticality")}
                            </Label>
                            <select
                              id={`crit-${step.id}`}
                              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                              value={d.criticality}
                              onChange={(e) =>
                                setDraft(step.id, {
                                  criticality: e.target.value as Criticality,
                                })
                              }
                            >
                              <option value="">{t("bia.notAssessed")}</option>
                              {CRITICALITIES.map((c) => (
                                <option key={c} value={c}>
                                  {criticalityLabel(c)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`mtpd-${step.id}`}>
                              {t("bia.mtpd")}
                            </Label>
                            <Input
                              id={`mtpd-${step.id}`}
                              inputMode="numeric"
                              value={d.mtpd}
                              onChange={(e) =>
                                setDraft(step.id, { mtpd: e.target.value })
                              }
                            />
                            <p className="text-xs text-gray-600">
                              {t("bia.mtpdHelp")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`rto-${step.id}`}>
                              {t("bia.rto")}
                            </Label>
                            <Input
                              id={`rto-${step.id}`}
                              inputMode="numeric"
                              value={d.rto}
                              onChange={(e) =>
                                setDraft(step.id, { rto: e.target.value })
                              }
                            />
                            <p className="text-xs text-gray-600">
                              {t("bia.rtoHelp")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`rpo-${step.id}`}>
                              {t("bia.rpo")}
                            </Label>
                            <Input
                              id={`rpo-${step.id}`}
                              inputMode="numeric"
                              value={d.rpo}
                              onChange={(e) =>
                                setDraft(step.id, { rpo: e.target.value })
                              }
                            />
                            <p className="text-xs text-gray-600">
                              {t("bia.rpoHelp")}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-1 md:col-span-2">
                            <Label htmlFor={`wa-${step.id}`}>
                              {t("bia.workaround")}
                            </Label>
                            <Textarea
                              id={`wa-${step.id}`}
                              rows={2}
                              value={d.workaround}
                              placeholder={t("bia.workaroundPlaceholder")}
                              onChange={(e) =>
                                setDraft(step.id, {
                                  workaround: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`wamax-${step.id}`}>
                              {t("bia.workaroundDuration")}
                            </Label>
                            <Input
                              id={`wamax-${step.id}`}
                              inputMode="numeric"
                              value={d.workaroundMax}
                              onChange={(e) =>
                                setDraft(step.id, {
                                  workaroundMax: e.target.value,
                                })
                              }
                            />
                            <p className="text-xs text-gray-600">
                              {t("bia.workaroundZeroHint")}
                            </p>
                          </div>
                        </div>

                        {resp.options.assessments.length > 0 && (
                          <div className="max-w-sm space-y-1">
                            <Label htmlFor={`assess-${step.id}`}>
                              {t("bia.assessment")}
                            </Label>
                            <select
                              id={`assess-${step.id}`}
                              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                              value={d.assessmentId}
                              onChange={(e) =>
                                setDraft(step.id, {
                                  assessmentId: e.target.value,
                                })
                              }
                            >
                              <option value="">{t("common.none")}</option>
                              {resp.options.assessments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {rowError[step.id] && (
                          <p className="text-sm text-red-700">
                            {rowError[step.id]}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => save(step)}
                            disabled={savingId === step.id || !d.criticality}
                          >
                            {savingId === step.id
                              ? t("common.saving")
                              : t("common.save")}
                          </Button>
                          {step.bia && (
                            <Button
                              variant="outline"
                              disabled={savingId === step.id}
                              onClick={() => remove(step)}
                            >
                              <Trash2
                                className="mr-2 h-4 w-4"
                                aria-hidden="true"
                              />
                              {t("bia.removeRow")}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ModuleGate>
  );
}
