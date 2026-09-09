"use client";

// BPM Overhaul Phase 5 P5: per-activity arctos:* properties side panel.
// Surfaces linked controls, documents, RACI, BCM-KPI, LoD, ROPA fields for
// the currently selected BPMN element.

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Network,
  Save,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { ProcessStatus } from "@grc/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProcessStatusBadge } from "@/components/process/process-status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Step {
  id: string;
  bpmnElementId: string;
  name: string | null;
  stepType?: string | null;
  lineOfDefense?: string | null;
  raciResponsibleRoleId?: string | null;
  raciAccountableRoleId?: string | null;
  // Call-Activity Drill-Down
  calledProcessId?: string | null;
  calledProcessName?: string | null;
  calledProcessStatus?: ProcessStatus | null;
}

interface ProcessSearchResult {
  id: string;
  name: string;
  status: ProcessStatus;
}

interface ControlLink {
  linkId: string;
  controlId: string;
  title: string;
  status: string;
}

interface CustomRole {
  id: string;
  name: string;
}

interface PanelData {
  step: Step | null;
  controls: ControlLink[];
  roles: CustomRole[];
  initialCi: Map<string, "C" | "I">;
}

// [OP-245 · Gestalt A] The four requests `reload()` used to issue from an
// effect, as one query function; the result seeds the editor below.
async function loadPanelData(
  processId: string,
  bpmnElementId: string,
): Promise<PanelData> {
  let step: Step | null = null;
  let controls: ControlLink[] = [];
  let roles: CustomRole[] = [];
  const initialCi = new Map<string, "C" | "I">();
  // Find the step record for this bpmn element
  const stepsResp = await fetch(`/api/v1/processes/${processId}/steps`);
  if (stepsResp.ok) {
    const j = await stepsResp.json();
    const found: Step | undefined = (j.data ?? []).find(
      (s: Step) => s.bpmnElementId === bpmnElementId,
    );
    if (found) {
      step = found;
      // Load controls linked to this step
      const ctlResp = await fetch(
        `/api/v1/processes/${processId}/steps/${found.id}/controls`,
      );
      if (ctlResp.ok) {
        const cj = await ctlResp.json();
        controls = cj.data ?? [];
      }
    }
  }
  // Roles for RACI dropdowns
  const rolesResp = await fetch(`/api/v1/custom-roles`);
  if (rolesResp.ok) {
    const r = await rolesResp.json();
    roles = r.data ?? [];
  }
  // B3.1: existing C/I overrides for this activity
  const ovResp = await fetch(
    `/api/v1/processes/${processId}/raci/overrides?activityBpmnId=${encodeURIComponent(bpmnElementId)}`,
  );
  if (ovResp.ok) {
    const ov = await ovResp.json();
    const rows: Array<{ participantBpmnId: string; raciRole: string }> =
      ov.data ?? [];
    for (const row of rows) {
      if (row.raciRole === "C" || row.raciRole === "I") {
        initialCi.set(row.participantBpmnId, row.raciRole);
      }
    }
  }
  return { step, controls, roles, initialCi };
}

export function ArctosPropertiesPanel({
  processId,
  bpmnElementId,
  onChange,
}: {
  processId: string;
  bpmnElementId: string;
  onChange?: () => void;
}) {
  // [OP-245 · Gestalt A] Fetch on mount via `@tanstack/react-query` instead of
  // an effect calling `reload()` (pattern from wave 7b). The panel is a form
  // seeded by the server, so it is split the way wave 7b split
  // `processes/[id]/ropa`: this component loads, the editor below owns the
  // editable copy and is mounted with a key per element. `staleTime: 0` and
  // `gcTime: 0` keep the old contract that every selection of an element
  // fetches afresh — a cached seed would show the values from before the
  // last save.
  const {
    data,
    isPending: loading,
    refetch,
  } = useQuery<PanelData>({
    queryKey: [
      "processes",
      processId,
      "steps",
      bpmnElementId,
      "arctos-properties",
    ],
    queryFn: () => loadPanelData(processId, bpmnElementId),
    staleTime: 0,
    gcTime: 0,
  });

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.step) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          This element has no DB-side step record yet — save the process to
          sync.
        </CardContent>
      </Card>
    );
  }

  return (
    <ArctosPropertiesEditor
      key={`${processId}:${bpmnElementId}`}
      processId={processId}
      bpmnElementId={bpmnElementId}
      onChange={onChange}
      step={data.step}
      controls={data.controls}
      roles={data.roles}
      initialCi={data.initialCi}
      reload={reload}
    />
  );
}

function ArctosPropertiesEditor({
  processId,
  bpmnElementId,
  onChange,
  step,
  controls,
  roles,
  initialCi: seedCi,
  reload,
}: {
  processId: string;
  bpmnElementId: string;
  onChange?: () => void;
  step: Step;
  controls: ControlLink[];
  roles: CustomRole[];
  initialCi: Map<string, "C" | "I">;
  reload: () => Promise<void>;
}) {
  const t = useTranslations("process");
  const tDrill = useTranslations("bpmOverhaul");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // The editable copy, seeded once per mount (the key above resets it when
  // another element is selected). A `reload()` after linking a process
  // updates `step` through the props and leaves unsaved edits in place.
  const [lod, setLod] = useState<string>(() => step.lineOfDefense ?? "");
  const [responsibleRole, setResponsibleRole] = useState<string>(
    () => step.raciResponsibleRoleId ?? "",
  );
  const [accountableRole, setAccountableRole] = useState<string>(
    () => step.raciAccountableRoleId ?? "",
  );
  // B3.1: Consulted / Informed role assignments — persisted as RACI
  // overrides (process_raci_override; participantBpmnId = role id).
  const [consultedIds, setConsultedIds] = useState<string[]>(() =>
    [...seedCi.entries()].filter(([, r]) => r === "C").map(([id]) => id),
  );
  const [informedIds, setInformedIds] = useState<string[]>(() =>
    [...seedCi.entries()].filter(([, r]) => r === "I").map(([id]) => id),
  );
  const [initialCi, setInitialCi] = useState<Map<string, "C" | "I">>(seedCi);
  // Call-Activity Drill-Down: linked-process search state
  const [processSearch, setProcessSearch] = useState("");
  const [linkingProcess, setLinkingProcess] = useState(false);

  // B3.1: toggle helpers — a role is either Consulted or Informed, not both.
  const toggleConsulted = useCallback((roleId: string, checked: boolean) => {
    setConsultedIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
    if (checked) {
      setInformedIds((prev) => prev.filter((id) => id !== roleId));
    }
  }, []);

  const toggleInformed = useCallback((roleId: string, checked: boolean) => {
    setInformedIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
    if (checked) {
      setConsultedIds((prev) => prev.filter((id) => id !== roleId));
    }
  }, []);

  // Call-Activity Drill-Down: only call activities and (collapsed)
  // subprocesses can invoke another process.
  const isCallStep =
    step.stepType === "call_activity" || step.stepType === "subprocess";

  // Debounced process search (org-scoped list API); the current process is
  // excluded — self-linking is rejected server-side anyway (422).
  // [OP-245 · Gestalt A/E] The effect cleared the results synchronously and
  // otherwise fetched after 300 ms; now it only debounces the term, the
  // request is a query keyed on the debounced term (pattern from batch B,
  // `graph/explorer`), and the results are visible only while the live term
  // is long enough. A non-ok answer yields an empty list (before: the
  // previous list stayed); a network failure yields an empty list as before.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(processSearch.trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [processSearch]);

  const { data: processSearchData = [], isFetching: processSearching } =
    useQuery<ProcessSearchResult[]>({
      queryKey: [
        "processes",
        "search",
        debouncedSearch,
        { exclude: processId },
      ],
      enabled: isCallStep && debouncedSearch.length >= 2,
      queryFn: async () => {
        const resp = await fetch(
          `/api/v1/processes?search=${encodeURIComponent(debouncedSearch)}&limit=10`,
        );
        if (!resp.ok) return [];
        const j = await resp.json();
        return ((j.data ?? []) as ProcessSearchResult[]).filter(
          (p) => p.id !== processId,
        );
      },
    });
  const processResults =
    isCallStep && processSearch.trim().length >= 2 ? processSearchData : [];

  const saveCalledProcess = useCallback(
    async (calledProcessId: string | null) => {
      if (!step) return;
      setLinkingProcess(true);
      try {
        const resp = await fetch(
          `/api/v1/processes/${processId}/steps/${step.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ calledProcessId }),
          },
        );
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          toast.error(e.error ?? tDrill("drilldown.saveError"));
          return;
        }
        toast.success(
          calledProcessId
            ? tDrill("drilldown.linkSaved")
            : tDrill("drilldown.linkRemoved"),
        );
        setProcessSearch("");
        await reload();
        onChange?.();
      } finally {
        setLinkingProcess(false);
      }
    },
    [step, processId, reload, onChange, tDrill],
  );

  const saveLod = useCallback(async () => {
    if (!step) return;
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/v1/processes/${processId}/steps/${step.id}/line-of-defense`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lineOfDefense: lod || null,
            raciResponsibleRoleId: responsibleRole || null,
            raciAccountableRoleId: accountableRole || null,
          }),
        },
      );
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? t("raci.saveError"));
        return;
      }

      // B3.1: sync Consulted/Informed overrides (process_raci_override).
      const desired = new Map<string, "C" | "I">();
      for (const roleId of consultedIds) desired.set(roleId, "C");
      for (const roleId of informedIds) desired.set(roleId, "I");

      const ops: Promise<Response>[] = [];
      for (const [roleId, raciRole] of desired) {
        if (initialCi.get(roleId) !== raciRole) {
          ops.push(
            fetch(`/api/v1/processes/${processId}/raci/overrides`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                activityBpmnId: bpmnElementId,
                participantBpmnId: roleId,
                raciRole,
              }),
            }),
          );
        }
      }
      for (const roleId of initialCi.keys()) {
        if (!desired.has(roleId)) {
          ops.push(
            fetch(
              `/api/v1/processes/${processId}/raci/overrides?activityBpmnId=${encodeURIComponent(bpmnElementId)}&participantBpmnId=${encodeURIComponent(roleId)}`,
              { method: "DELETE" },
            ),
          );
        }
      }
      const results = await Promise.all(ops);
      if (results.some((r) => !r.ok)) {
        toast.error(t("raci.saveError"));
        return;
      }
      setInitialCi(desired);

      toast.success(t("raci.saved"));
      onChange?.();
    } finally {
      setSaving(false);
    }
  }, [
    step,
    processId,
    bpmnElementId,
    lod,
    responsibleRole,
    accountableRole,
    consultedIds,
    informedIds,
    initialCi,
    onChange,
    t,
  ]);

  return (
    <div className="space-y-3">
      {/* Call-Activity Drill-Down: linked child process */}
      {isCallStep && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4" />{" "}
              {tDrill("drilldown.linkedProcess")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {step.calledProcessId ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {step.calledProcessName ??
                        tDrill("drilldown.relations.orphanedEntry")}
                    </p>
                    {step.calledProcessStatus && (
                      <ProcessStatusBadge
                        status={step.calledProcessStatus}
                        size="sm"
                        className="mt-1"
                      />
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {step.calledProcessName && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={tDrill("drilldown.openProcess")}
                        onClick={() =>
                          router.push(
                            `/processes/${step.calledProcessId}?from=${processId}`,
                          )
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-500"
                      title={tDrill("drilldown.unlink")}
                      disabled={linkingProcess}
                      onClick={() => void saveCalledProcess(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {!step.calledProcessName && (
                  <p className="text-xs text-amber-600">
                    {tDrill("drilldown.orphaned")}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {tDrill("drilldown.notLinked")}
                </p>
                <Input
                  className="h-8"
                  value={processSearch}
                  onChange={(e) => setProcessSearch(e.target.value)}
                  placeholder={tDrill("drilldown.searchPlaceholder")}
                />
                {processSearching && (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {processResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {processResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={linkingProcess}
                        className="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                        onClick={() => void saveCalledProcess(p.id)}
                      >
                        <span className="truncate font-medium">{p.name}</span>
                        <ProcessStatusBadge status={p.status} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
                {processSearch.trim().length >= 2 &&
                  !processSearching &&
                  processResults.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {tDrill("drilldown.noResults")}
                    </p>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Three-Lines-of-Defense + RACI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Line of Defense</Label>
            <Select value={lod} onValueChange={setLod}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(inherit)</SelectItem>
                <SelectItem value="first">First (Operations)</SelectItem>
                <SelectItem value="second">
                  Second (Risk / Compliance)
                </SelectItem>
                <SelectItem value="third">Third (Audit)</SelectItem>
                <SelectItem value="oversight">Oversight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">RACI: Responsible role</Label>
            <Select value={responsibleRole} onValueChange={setResponsibleRole}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(none)</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">RACI: Accountable role</Label>
            <Select value={accountableRole} onValueChange={setAccountableRole}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(none)</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* B3.1: Consulted / Informed multi-select */}
          <div>
            <Label className="text-xs">{t("raci.consulted")}</Label>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
              {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("raci.noRoles")}
                </p>
              ) : (
                roles.map((r) => (
                  <label
                    key={`c-${r.id}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={consultedIds.includes(r.id)}
                      onCheckedChange={(v) => toggleConsulted(r.id, v === true)}
                    />
                    {r.name}
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("raci.informed")}</Label>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
              {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("raci.noRoles")}
                </p>
              ) : (
                roles.map((r) => (
                  <label
                    key={`i-${r.id}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={informedIds.includes(r.id)}
                      onCheckedChange={(v) => toggleInformed(r.id, v === true)}
                    />
                    {r.name}
                  </label>
                ))
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={saveLod}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4" /> Linked controls (
            {controls.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {controls.length === 0 ? (
            <p className="text-xs text-muted-foreground">No controls linked.</p>
          ) : (
            <ul className="space-y-1">
              {controls.map((c) => (
                <li key={c.linkId} className="text-sm">
                  <span className="font-medium">{c.title}</span>{" "}
                  <Badge variant="outline" className="text-xs">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
