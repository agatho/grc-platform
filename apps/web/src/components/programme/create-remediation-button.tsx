"use client";

// Create-Remediation-Button — Audit-Finding → Mini-Programme.
//
// Drop-in button für jede Finding-Detail-Page. Öffnet kleinen Dialog wo
// der User Severity-Mapping bestätigen, optional Owner + Frist anpassen,
// dann POST /api/v1/programmes/reverse-from-finding aufruft und auf die
// neu erzeugte Mini-Journey navigiert.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Wrench } from "lucide-react";

type FindingSeverity =
  | "positive"
  | "conforming"
  | "opportunity_for_improvement"
  | "minor_nonconformity"
  | "major_nonconformity"
  | "observation"
  | "recommendation"
  | "improvement_requirement"
  | "insignificant_nonconformity"
  | "significant_nonconformity";

type RemediationSeverity = "major" | "minor" | "observation";

function mapSeverity(s: FindingSeverity): RemediationSeverity {
  switch (s) {
    case "major_nonconformity":
    case "significant_nonconformity":
      return "major";
    case "minor_nonconformity":
    case "insignificant_nonconformity":
    case "improvement_requirement":
      return "minor";
    case "observation":
    case "opportunity_for_improvement":
    case "recommendation":
    default:
      return "observation";
  }
}

const DEFAULT_DUE_DAYS: Record<RemediationSeverity, number> = {
  major: 30,
  minor: 90,
  observation: 180,
};

interface Props {
  findingId: string;
  findingTitle: string;
  findingSeverity: FindingSeverity;
  /** Optional inline variant (smaller, for table rows) */
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function CreateRemediationButton({
  findingId,
  findingTitle,
  findingSeverity,
  variant = "outline",
  size = "default",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<RemediationSeverity>(
    mapSeverity(findingSeverity),
  );
  const [dueInDays, setDueInDays] = useState<number>(
    DEFAULT_DUE_DAYS[mapSeverity(findingSeverity)],
  );
  const [description, setDescription] = useState("");

  // When severity changes, update default dueInDays
  function changeSeverity(s: RemediationSeverity) {
    setSeverity(s);
    setDueInDays(DEFAULT_DUE_DAYS[s]);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/programmes/reverse-from-finding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          findingTitle,
          severity,
          dueInDays,
          description: description.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j.error ?? j.reason ?? `HTTP ${r.status}`);
      }
      const journeyId = j.data?.journey?.id;
      if (!journeyId) throw new Error("Kein Journey-ID in der Antwort");
      // Navigate to the new mini-journey
      router.push(`/programmes/${journeyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          // Reset state when opening
          const mapped = mapSeverity(findingSeverity);
          setSeverity(mapped);
          setDueInDays(DEFAULT_DUE_DAYS[mapped]);
          setDescription("");
          setError(null);
          setOpen(true);
        }}
      >
        <Wrench className="mr-2 size-4" />
        Behebungsprogramm
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Behebungsprogramm aus Finding erstellen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Generiert eine Mini-Journey im Programme-Cockpit mit 3 Schritten:{" "}
                <strong>Root-Cause-Analyse</strong>,{" "}
                <strong>Korrekturmaßnahme</strong>,{" "}
                <strong>Wirksamkeits-Verifikation</strong>. Pro Schritt 2-3
                vorgenerierte Subtasks. Cross-Link zum Original-Finding wird
                automatisch gesetzt.
              </span>
              <span className="block text-xs text-slate-500">
                Quelle: <em>{findingTitle}</em>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rem-severity">
                Severity (bestimmt Default-Frist)
              </Label>
              <select
                id="rem-severity"
                value={severity}
                onChange={(e) =>
                  changeSeverity(e.target.value as RemediationSeverity)
                }
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
              >
                <option value="major">
                  Major (Default 30 Tage Frist)
                </option>
                <option value="minor">Minor (Default 90 Tage Frist)</option>
                <option value="observation">
                  Observation (Default 180 Tage Frist)
                </option>
              </select>
              <p className="text-xs text-slate-500">
                Auto-gemappt von Finding-Severity „{findingSeverity}". Anpassbar.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-due">Frist (Tage)</Label>
              <Input
                id="rem-due"
                type="number"
                min="1"
                max="365"
                value={dueInDays}
                onChange={(e) =>
                  setDueInDays(parseInt(e.target.value, 10) || 30)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-desc">Zusatz-Beschreibung (optional)</Label>
              <textarea
                id="rem-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Kontext, Aufseherbescheid, Bezug zu Audit-Stage etc."
                className="flex w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm dark:border-slate-800"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Programm erstellen + öffnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
