"use client";

// BPM Overhaul Phase 5 P5: per-activity arctos:* properties side panel.
// Surfaces linked controls, documents, RACI, BCM-KPI, LoD, ROPA fields for
// the currently selected BPMN element.

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, FileText, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  lineOfDefense?: string | null;
  raciResponsibleRoleId?: string | null;
  raciAccountableRoleId?: string | null;
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
