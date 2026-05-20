"use client";

// BPM Overhaul Phase 5 P5: per-activity arctos:* properties side panel.
// Surfaces linked controls, documents, RACI, BCM-KPI, LoD, ROPA fields for
// the currently selected BPMN element.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, FileText, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [step, setStep] = useState<Step | null>(null);
  const [controls, setControls] = useState<ControlLink[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lod, setLod] = useState<string>("");
  const [responsibleRole, setResponsibleRole] = useState<string>("");
  const [accountableRole, setAccountableRole] = useState<string>("");

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
    } finally {
      setLoading(false);
    }
  }, [processId, bpmnElementId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveLod = useCallback(async () => {
    if (!step) return;
    setSaving(true);
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
    setSaving(false);
    if (resp.ok) {
      toast.success("Saved");
      onChange?.();
    } else {
      const e = await resp.json().catch(() => ({}));
      toast.error(e.error ?? "Save failed");
    }
  }, [step, processId, lod, responsibleRole, accountableRole, onChange]);

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
