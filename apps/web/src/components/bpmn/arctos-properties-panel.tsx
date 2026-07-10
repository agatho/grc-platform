"use client";

// BPM Overhaul Phase 5 P5: per-activity arctos:* properties side panel.
// Surfaces linked controls, documents, RACI, BCM-KPI, LoD, ROPA fields for
// the currently selected BPMN element.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Network,
  Save,
  ShieldCheck,
  FileText,
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

export function ArctosPropertiesPanel({
  processId,
  bpmnElementId,
  onChange,
}: {
  processId: string;
  bpmnElementId: string;
  onChange?: () => void;
}) {
  const t = useTranslations("process");
  const tDrill = useTranslations("bpmOverhaul");
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [controls, setControls] = useState<ControlLink[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lod, setLod] = useState<string>("");
  const [responsibleRole, setResponsibleRole] = useState<string>("");
  const [accountableRole, setAccountableRole] = useState<string>("");
  // B3.1: Consulted / Informed role assignments — persisted as RACI
  // overrides (process_raci_override; participantBpmnId = role id).
  const [consultedIds, setConsultedIds] = useState<string[]>([]);
  const [informedIds, setInformedIds] = useState<string[]>([]);
  const [initialCi, setInitialCi] = useState<Map<string, "C" | "I">>(
    new Map(),
  );
  // Call-Activity Drill-Down: linked-process search state
  const [processSearch, setProcessSearch] = useState("");
  const [processResults, setProcessResults] = useState<ProcessSearchResult[]>(
    [],
  );
  const [processSearching, setProcessSearching] = useState(false);
  const [linkingProcess, setLinkingProcess] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Find the step record for this bpmn element
      const stepsResp = await fetch(`/api/v1/processes/${processId}/steps`);
      if (stepsResp.ok) {
        const j = await stepsResp.json();
        const found: Step | undefined = (j.data ?? []).find(
          (s: Step) => s.bpmnElementId === bpmnElementId,
        );
        if (found) {
          setStep(found);
          setLod(found.lineOfDefense ?? "");
          setResponsibleRole(found.raciResponsibleRoleId ?? "");
          setAccountableRole(found.raciAccountableRoleId ?? "");

          // Load controls linked to this step
          const ctlResp = await fetch(
            `/api/v1/processes/${processId}/steps/${found.id}/controls`,
          );
          if (ctlResp.ok) {
            const cj = await ctlResp.json();
            setControls(cj.data ?? []);
          }
        }
      }
      // Roles for RACI dropdowns
      const rolesResp = await fetch(`/api/v1/custom-roles`);
      if (rolesResp.ok) {
        const r = await rolesResp.json();
        setRoles(r.data ?? []);
      }
      // B3.1: existing C/I overrides for this activity
      const ovResp = await fetch(
        `/api/v1/processes/${processId}/raci/overrides?activityBpmnId=${encodeURIComponent(bpmnElementId)}`,
      );
      if (ovResp.ok) {
        const ov = await ovResp.json();
        const rows: Array<{ participantBpmnId: string; raciRole: string }> =
          ov.data ?? [];
        const ci = new Map<string, "C" | "I">();
        for (const row of rows) {
          if (row.raciRole === "C" || row.raciRole === "I") {
            ci.set(row.participantBpmnId, row.raciRole);
          }
        }
        setInitialCi(ci);
        setConsultedIds(
          [...ci.entries()].filter(([, r]) => r === "C").map(([id]) => id),
        );
        setInformedIds(
          [...ci.entries()].filter(([, r]) => r === "I").map(([id]) => id),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [processId, bpmnElementId]);

  useEffect(() => {
    reload();
  }, [reload]);

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
    step?.stepType === "call_activity" || step?.stepType === "subprocess";

  // Debounced process search (org-scoped list API); the current process is
  // excluded — self-linking is rejected server-side anyway (422).
  useEffect(() => {
    if (!isCallStep || processSearch.trim().length < 2) {
      setProcessResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setProcessSearching(true);
      try {
        const resp = await fetch(
          `/api/v1/processes?search=${encodeURIComponent(processSearch.trim())}&limit=10`,
        );
        if (resp.ok) {
          const j = await resp.json();
          setProcessResults(
            ((j.data ?? []) as ProcessSearchResult[]).filter(
              (p) => p.id !== processId,
            ),
          );
        }
      } catch {
        setProcessResults([]);
      } finally {
        setProcessSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [processSearch, processId, isCallStep]);

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
        setProcessResults([]);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!step) {
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
