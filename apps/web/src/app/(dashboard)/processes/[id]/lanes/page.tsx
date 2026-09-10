"use client";

// [ARCTOS-FULL-2026-08-31 · OP-001] Pflegemaske 1 von 4 — `process_lane`.
//
// Gepflegt wird ausschliesslich der TRÄGER einer Lane: Rolle,
// Organisationseinheit, Dienstleister, „extern", Drittland. Name, Art und
// Reihenfolge stehen im BPMN-Modell und werden vom Import gehalten (OP-002) —
// sie sind hier bewusst nur lesbar, weil das nächste Speichern einer Version
// sie ohnehin überschriebe.
//
// Der Ladepfad geht über `fetchJson`, nicht über nacktes `fetch`: ein Fehler
// muss als Fehler erscheinen. Der Leerzustand dieser Seite bedeutet „dieser
// Prozess hat keine Lanes", und das ist eine Aussage über den Datenbestand —
// eine kaputte Anfrage darf sie nicht treffen (OP-050).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, AlertTriangle, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorRetry } from "@/components/ui/error-retry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { fetchJson, ApiRequestError } from "@/lib/api-client";

interface LaneRow {
  id: string;
  bpmnElementId: string;
  name: string | null;
  kind: string;
  assignedStepCount: number;
  inDiagram: boolean | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  isExternal: boolean;
  thirdCountry: string | null;
}

interface Option {
  id: string;
  name: string;
}

interface LanesResponse {
  data: LaneRow[];
  meta: {
    processId: string;
    processName: string;
    unassignedSteps: number;
    diagramKnown: boolean;
  };
  options: {
    roles: Option[];
    orgUnits: Option[];
    vendors: Option[];
    vendorsTruncated: boolean;
    vendorLimit: number;
  };
}

/** Der bearbeitbare Teil einer Zeile — genau die Felder, die nicht im XML stehen. */
interface Draft {
  customRoleId: string;
  orgUnitId: string;
  vendorId: string;
  isExternal: boolean;
  thirdCountry: string;
}

function draftOf(row: LaneRow): Draft {
  return {
    customRoleId: row.customRoleId ?? "",
    orgUnitId: row.orgUnitId ?? "",
    vendorId: row.vendorId ?? "",
    isExternal: row.isExternal,
    thirdCountry: row.thirdCountry ?? "",
  };
}

export default function ProcessLanesPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const t = useTranslations("processGrc");

  const [resp, setResp] = useState<LanesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [vendorQuery, setVendorQuery] = useState("");

  const load = useCallback(
    async (query: string) => {
      if (!processId) return;
      setLoading(true);
      setError(null);
      try {
        const json = await fetchJson<LanesResponse>(
          `/api/v1/processes/${processId}/lanes${
            query ? `?vendorQuery=${encodeURIComponent(query)}` : ""
          }`,
        );
        setResp(json);
        const next: Record<string, Draft> = {};
        for (const row of json.data) next[row.id] = draftOf(row);
        setDrafts(next);
      } catch (e) {
        // Kein `setResp([])`: der Fehler wird gezeigt, nicht in einen
        // Leerzustand übersetzt.
        setError(
          e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
        );
      } finally {
        setLoading(false);
      }
    },
    [processId],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  const save = async (row: LaneRow) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setRowError((prev) => ({ ...prev, [row.id]: "" }));
    try {
      await fetchJson(`/api/v1/processes/${processId}/lanes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customRoleId: draft.customRoleId || null,
          orgUnitId: draft.orgUnitId || null,
          vendorId: draft.vendorId || null,
          isExternal: draft.isExternal,
          thirdCountry: draft.thirdCountry
            ? draft.thirdCountry.toUpperCase()
            : null,
        }),
      });
      await load(vendorQuery);
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [row.id]:
          e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
      }));
    } finally {
      setSavingId(null);
    }
  };

  const removeOrphan = async (row: LaneRow) => {
    setSavingId(row.id);
    try {
      await fetchJson(`/api/v1/processes/${processId}/lanes/${row.id}`, {
        method: "DELETE",
      });
      await load(vendorQuery);
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [row.id]:
          e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
      }));
    } finally {
      setSavingId(null);
    }
  };

  const setDraft = (laneId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [laneId]: { ...prev[laneId], ...patch },
    }));

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
          <h1 className="text-2xl font-semibold">{t("lanes.title")}</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            {t("lanes.description")}
          </p>
        </div>

        {loading && !resp && (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("common.loading")}
          </p>
        )}

        {error && (
          <ErrorRetry message={error} onRetry={() => load(vendorQuery)} />
        )}

        {resp && !error && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              {resp.meta.unassignedSteps > 0 && (
                <span>
                  {t("lanes.unassignedSteps", {
                    count: resp.meta.unassignedSteps,
                  })}
                </span>
              )}
              {!resp.meta.diagramKnown && (
                <span>{t("lanes.diagramUnknown")}</span>
              )}
            </div>

            <div className="max-w-sm space-y-1">
              <Label htmlFor="vendor-query">{t("common.search")}</Label>
              <Input
                id="vendor-query"
                value={vendorQuery}
                placeholder={t("lanes.vendorSearchPlaceholder")}
                onChange={(e) => setVendorQuery(e.target.value)}
                onBlur={() => load(vendorQuery)}
              />
              {resp.options.vendorsTruncated && (
                <p className="text-xs text-gray-600">
                  {t("lanes.vendorsTruncated", {
                    limit: resp.options.vendorLimit,
                  })}
                </p>
              )}
            </div>

            {resp.data.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-gray-700">
                  {t("lanes.empty")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {resp.data.map((row) => {
                  const draft = drafts[row.id] ?? draftOf(row);
                  return (
                    <Card key={row.id}>
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                          <span>{row.name ?? row.bpmnElementId}</span>
                          <Badge variant="outline">
                            {row.kind === "pool"
                              ? t("lanes.kindPool")
                              : t("lanes.kindLane")}
                          </Badge>
                          {row.inDiagram === false && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                              <AlertTriangle
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              {t("lanes.notInDiagram")}
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {row.bpmnElementId} · {t("lanes.columnSteps")}:{" "}
                          {row.assignedStepCount}
                          {row.inDiagram === false
                            ? ` · ${t("lanes.notInDiagramHint")}`
                            : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`role-${row.id}`}>
                              {t("lanes.columnRole")}
                            </Label>
                            <select
                              id={`role-${row.id}`}
                              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                              value={draft.customRoleId}
                              onChange={(e) =>
                                setDraft(row.id, {
                                  customRoleId: e.target.value,
                                })
                              }
                            >
                              <option value="">{t("common.none")}</option>
                              {resp.options.roles.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`unit-${row.id}`}>
                              {t("lanes.columnOrgUnit")}
                            </Label>
                            <select
                              id={`unit-${row.id}`}
                              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                              value={draft.orgUnitId}
                              onChange={(e) =>
                                setDraft(row.id, { orgUnitId: e.target.value })
                              }
                            >
                              <option value="">{t("common.none")}</option>
                              {resp.options.orgUnits.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`vendor-${row.id}`}>
                              {t("lanes.columnVendor")}
                            </Label>
                            <select
                              id={`vendor-${row.id}`}
                              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                              value={draft.vendorId}
                              onChange={(e) =>
                                setDraft(row.id, { vendorId: e.target.value })
                              }
                            >
                              <option value="">{t("common.none")}</option>
                              {/* Der aktuell hinterlegte Dienstleister bleibt
                                  wählbar, auch wenn die Suche ihn gerade nicht
                                  liefert — sonst löschte ein Speichern ihn. */}
                              {row.vendorId &&
                                !resp.options.vendors.some(
                                  (v) => v.id === row.vendorId,
                                ) && (
                                  <option value={row.vendorId}>
                                    {row.vendorName ?? row.vendorId}
                                  </option>
                                )}
                              {resp.options.vendors.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`external-${row.id}`}
                              checked={draft.isExternal}
                              onCheckedChange={(v) =>
                                setDraft(row.id, {
                                  isExternal: v === true,
                                  thirdCountry:
                                    v === true ? draft.thirdCountry : "",
                                })
                              }
                            />
                            <Label htmlFor={`external-${row.id}`}>
                              {t("lanes.externalLabel")}
                            </Label>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`country-${row.id}`}>
                              {t("lanes.columnThirdCountry")}
                            </Label>
                            <Input
                              id={`country-${row.id}`}
                              maxLength={2}
                              disabled={!draft.isExternal}
                              value={draft.thirdCountry}
                              placeholder={t("lanes.thirdCountryPlaceholder")}
                              onChange={(e) =>
                                setDraft(row.id, {
                                  thirdCountry: e.target.value.toUpperCase(),
                                })
                              }
                            />
                            <p className="text-xs text-gray-600">
                              {t("lanes.thirdCountryHelp")}
                            </p>
                          </div>
                        </div>

                        {rowError[row.id] && (
                          <p className="text-sm text-red-700">
                            {rowError[row.id]}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => save(row)}
                            disabled={savingId === row.id}
                          >
                            {savingId === row.id
                              ? t("common.saving")
                              : t("common.save")}
                          </Button>
                          {row.inDiagram === false && (
                            <Button
                              variant="outline"
                              disabled={savingId === row.id}
                              onClick={() => {
                                if (window.confirm(t("lanes.deleteConfirm"))) {
                                  void removeOrphan(row);
                                }
                              }}
                            >
                              <Trash2
                                className="mr-2 h-4 w-4"
                                aria-hidden="true"
                              />
                              {t("lanes.deleteOrphan")}
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
