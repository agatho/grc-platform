"use client";

// [ARCTOS-FULL-2026-08-31 · OP-001] Pflegemaske 3 von 4 — `process_step_raci`.
//
// C und I haben ausserhalb dieser Tabelle keine Heimat: `process_raci_override`
// benennt Beteiligte über rohe BPMN-Lane-IDs ohne Fremdschlüssel auf
// `custom_role` (STUFE2-E §1.3). Solange die Tabelle leer war, blieben
// `raci.consulted` und `raci.informed` im Diagrammvertrag dauerhaft leer.
//
// Die Maske schreibt je Schritt ERSETZEND (PUT). Additiv wäre bequemer zu
// bauen und hätte keine Bedienoperation für „diese Rolle ist hier nicht mehr
// zu konsultieren" — eine Aussage, die eine Pflegeoberfläche treffen muss.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorRetry } from "@/components/ui/error-retry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { fetchJson, ApiRequestError } from "@/lib/api-client";

const LETTERS = ["R", "A", "C", "I"] as const;
type Letter = (typeof LETTERS)[number];

interface Entry {
  roleId: string;
  roleName: string | null;
  raciRole: string;
}

interface StepRow {
  id: string;
  bpmnElementId: string;
  name: string | null;
  sequenceOrder: number;
  raci: Entry[];
}

interface Option {
  id: string;
  name: string;
}

interface RaciResponse {
  data: StepRow[];
  meta: { processId: string; processName: string };
  options: { roles: Option[] };
}

export default function StepRaciPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const t = useTranslations("processGrc");

  const [resp, setResp] = useState<RaciResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Entry[]>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pick, setPick] = useState<
    Record<string, { role: string; letter: Letter }>
  >({});

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<RaciResponse>(
        `/api/v1/processes/${processId}/step-raci`,
      );
      setResp(json);
      const next: Record<string, Entry[]> = {};
      for (const s of json.data) next[s.id] = s.raci;
      setDrafts(next);
      setDirty({});
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

  const letterLabel = (letter: string) =>
    letter === "R"
      ? t("raci.letterR")
      : letter === "A"
        ? t("raci.letterA")
        : letter === "C"
          ? t("raci.letterC")
          : t("raci.letterI");

  const addEntry = (step: StepRow) => {
    const chosen = pick[step.id];
    if (!chosen?.role) return;
    const current = drafts[step.id] ?? [];
    if (
      current.some(
        (e) => e.roleId === chosen.role && e.raciRole === chosen.letter,
      )
    ) {
      setRowError((p) => ({ ...p, [step.id]: t("raci.duplicate") }));
      return;
    }
    const role = resp?.options.roles.find((r) => r.id === chosen.role);
    setRowError((p) => ({ ...p, [step.id]: "" }));
    setDrafts((p) => ({
      ...p,
      [step.id]: [
        ...current,
        {
          roleId: chosen.role,
          roleName: role?.name ?? null,
          raciRole: chosen.letter,
        },
      ],
    }));
    setDirty((p) => ({ ...p, [step.id]: true }));
  };

  const removeEntry = (stepId: string, index: number) => {
    setDrafts((p) => ({
      ...p,
      [stepId]: (p[stepId] ?? []).filter((_, i) => i !== index),
    }));
    setDirty((p) => ({ ...p, [stepId]: true }));
  };

  const save = async (step: StepRow) => {
    setSavingId(step.id);
    setRowError((p) => ({ ...p, [step.id]: "" }));
    try {
      await fetchJson(`/api/v1/processes/${processId}/step-raci/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: (drafts[step.id] ?? []).map((e) => ({
            roleId: e.roleId,
            raciRole: e.raciRole,
          })),
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

  const roles = resp?.options.roles ?? [];

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
          <h1 className="text-2xl font-semibold">{t("raci.title")}</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            {t("raci.description")}
          </p>
        </div>

        {loading && !resp && (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("common.loading")}
          </p>
        )}

        {error && <ErrorRetry message={error} onRetry={load} />}

        {resp && !error && resp.data.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-gray-700">
              {t("raci.empty")}
            </CardContent>
          </Card>
        )}

        {resp && !error && roles.length === 0 && resp.data.length > 0 && (
          <p className="text-sm text-gray-700">{t("raci.noRoles")}</p>
        )}

        {resp && !error && (
          <div className="space-y-4">
            {resp.data.map((step) => {
              const entries = drafts[step.id] ?? [];
              const chosen = pick[step.id] ?? {
                role: "",
                letter: "R" as Letter,
              };
              return (
                <Card key={step.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {step.name ?? step.bpmnElementId}
                    </CardTitle>
                    <CardDescription>
                      {step.bpmnElementId}
                      {dirty[step.id] ? ` · ${t("raci.unsaved")}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {entries.length === 0 ? (
                      <p className="text-sm text-gray-600">
                        {t("raci.noEntries")}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {entries.map((e, i) => (
                          <li
                            key={`${e.roleId}-${e.raciRole}`}
                            className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-sm text-gray-800"
                          >
                            <span>
                              {e.roleName ?? e.roleId} · {e.raciRole}
                            </span>
                            <button
                              type="button"
                              className="rounded p-0.5 text-gray-700 hover:bg-gray-200"
                              aria-label={t("raci.removeEntry", {
                                role: e.roleName ?? e.roleId,
                                letter: e.raciRole,
                              })}
                              onClick={() => removeEntry(step.id, i)}
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {roles.length > 0 && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`raci-role-${step.id}`}>
                            {t("common.role")}
                          </Label>
                          <select
                            id={`raci-role-${step.id}`}
                            className="rounded border border-gray-300 bg-white p-2 text-sm"
                            value={chosen.role}
                            onChange={(ev) =>
                              setPick((p) => ({
                                ...p,
                                [step.id]: {
                                  ...chosen,
                                  role: ev.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">{t("common.none")}</option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`raci-letter-${step.id}`}>
                            {t("raci.addEntry")}
                          </Label>
                          <select
                            id={`raci-letter-${step.id}`}
                            className="rounded border border-gray-300 bg-white p-2 text-sm"
                            value={chosen.letter}
                            onChange={(ev) =>
                              setPick((p) => ({
                                ...p,
                                [step.id]: {
                                  ...chosen,
                                  letter: ev.target.value as Letter,
                                },
                              }))
                            }
                          >
                            {LETTERS.map((l) => (
                              <option key={l} value={l}>
                                {letterLabel(l)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => addEntry(step)}
                          disabled={!chosen.role}
                        >
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t("common.add")}
                        </Button>
                      </div>
                    )}

                    {rowError[step.id] && (
                      <p className="text-sm text-red-700">
                        {rowError[step.id]}
                      </p>
                    )}

                    <Button
                      onClick={() => save(step)}
                      disabled={savingId === step.id || !dirty[step.id]}
                    >
                      {savingId === step.id
                        ? t("common.saving")
                        : t("common.save")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ModuleGate>
  );
}
