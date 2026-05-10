"use client";

// Custom-Step-Dialog — Org-spezifischen Schritt zu einer Journey hinzufügen.
//
// Nutzungs-Use-Case: Journey läuft schon, aber Org bemerkt dass ein zusätzlicher
// Schritt notwendig ist (z. B. interner Genehmigungsprozess vor Stage-1-
// Audit), der nicht im Standard-Template enthalten ist. Statt das Template
// zu forken, fügt der Admin den Step direkt zur Journey hinzu.
//
// API: POST /api/v1/programmes/journeys/[id]/steps
// Permissions: admin / risk_manager (auf Backend-Seite enforced)

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  pdcaPhase?: string;
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  journeyId: string;
  phases: Phase[];
  /** Optional callback after successful creation */
  onCreated?: () => void;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline";
  buttonSize?: "default" | "sm";
}

const OWNER_ROLES = [
  "admin",
  "risk_manager",
  "control_owner",
  "process_owner",
  "auditor",
  "dpo",
  "viewer",
];

export function CustomStepDialog({
  journeyId,
  phases,
  onCreated,
  buttonLabel = "Custom-Step hinzufügen",
  buttonVariant = "outline",
  buttonSize = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [phaseId, setPhaseId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isoClause, setIsoClause] = useState("");
  const [defaultOwnerRole, setDefaultOwnerRole] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [isMandatory, setIsMandatory] = useState(false);
  const [requiredEvidenceCount, setRequiredEvidenceCount] = useState<number>(0);

  // Org users for owner picker
  const [users, setUsers] = useState<OrgUser[]>([]);

  useEffect(() => {
    if (!open) return;
    // Load org users for owner picker on dialog open
    (async () => {
      try {
        const r = await fetch("/api/v1/programmes/users");
        if (r.ok) {
          const j = await r.json();
          setUsers(j.data ?? []);
        }
      } catch {}
    })();
  }, [open]);

  function reset() {
    setPhaseId(phases[0]?.id ?? "");
    setName("");
    setDescription("");
    setIsoClause("");
    setDefaultOwnerRole("");
    setOwnerId("");
    setDueDate("");
    setIsMilestone(false);
    setIsMandatory(false);
    setRequiredEvidenceCount(0);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  async function handleSubmit() {
    if (!phaseId) {
      setError("Bitte Phase auswählen.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name muss mindestens 2 Zeichen lang sein.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/programmes/journeys/${journeyId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseId,
          name: name.trim(),
          description: description.trim() || undefined,
          isoClause: isoClause.trim() || undefined,
          defaultOwnerRole: defaultOwnerRole || undefined,
          ownerId: ownerId || null,
          dueDate: dueDate || null,
          isMilestone,
          isMandatory,
          requiredEvidenceCount,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j.error ?? j.reason ?? `HTTP ${r.status}`);
      }
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => handleOpenChange(true)}
      >
        <Plus className="mr-2 size-4" />
        {buttonLabel}
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Custom-Step zur Journey hinzufügen
            </AlertDialogTitle>
            <AlertDialogDescription>
              Schritt der nicht im Standard-Template enthalten ist — z. B.
              org-spezifischer Genehmigungsprozess. Gilt nur für diese Journey
              und wird mit anderen Steps zusammen abgearbeitet.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cs-phase">Phase *</Label>
              <select
                id="cs-phase"
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
              >
                <option value="">— bitte wählen —</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.pdcaPhase ? ` (${p.pdcaPhase.toUpperCase()})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cs-name">Name *</Label>
              <Input
                id="cs-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={300}
                placeholder="z. B. Internes GL-Approval vor Stage-1"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cs-desc">Beschreibung</Label>
              <Textarea
                id="cs-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Was ist zu tun? Welcher Output? Wer ist beteiligt?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-iso">ISO-Klausel (optional)</Label>
              <Input
                id="cs-iso"
                value={isoClause}
                onChange={(e) => setIsoClause(e.target.value)}
                placeholder="z. B. 5.1, A.5.9"
                maxLength={50}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-role">Default-Owner-Rolle</Label>
              <select
                id="cs-role"
                value={defaultOwnerRole}
                onChange={(e) => setDefaultOwnerRole(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
              >
                <option value="">— keine —</option>
                {OWNER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-owner">Verantwortlicher</Label>
              <select
                id="cs-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
              >
                <option value="">— nicht zugewiesen —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-due">Fälligkeit</Label>
              <Input
                id="cs-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-evidence">Pflicht-Belege (Anzahl)</Label>
              <Input
                id="cs-evidence"
                type="number"
                min="0"
                max="20"
                value={requiredEvidenceCount}
                onChange={(e) =>
                  setRequiredEvidenceCount(parseInt(e.target.value, 10) || 0)
                }
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className="size-4 rounded border-slate-300"
                />
                Meilenstein
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  className="size-4 rounded border-slate-300"
                />
                Pflicht-Schritt (kann nicht übersprungen werden)
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={busy || !phaseId || name.trim().length < 2}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Schritt anlegen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
