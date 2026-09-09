"use client";

// BPM Overhaul Phase 4 C2: Compliance Profile dropdown.
// Toggles which set of fields the process detail page foregrounds.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Layers } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROFILES = [
  { value: "standard", label: "Standard" },
  { value: "gdpr_ropa", label: "GDPR ROPA" },
  { value: "iso_22301_bia", label: "ISO 22301 BIA" },
  { value: "nis2_critical", label: "NIS2 Critical" },
  { value: "iso_9001_quality", label: "ISO 9001 Quality" },
  { value: "dora_critical_ict", label: "DORA Critical ICT" },
];

export function ProcessComplianceProfileSwitcher({
  processId,
  initialProfile,
  onChange,
}: {
  processId: string;
  initialProfile?: string | null;
  onChange?: (newProfile: string) => void;
}) {
  // [Welle 7a · OP-080] `profile` wurde hier gelesen, stand aber nicht in der
  // Abhaengigkeitsliste; der Kommentar „Only react to initialProfile changes"
  // beschrieb die Absicht und nicht den Code.
  //
  // [OP-245 · Gestalt E] Der Effekt, der `initialProfile` in den Zustand
  // spiegelte, entfaellt: das Prop gilt, solange keine eigene Wahl vorliegt.
  // Die eigene Wahl merkt sich den Prop-Stand, unter dem sie getroffen wurde,
  // und verfaellt, sobald der Aufrufer ein neues `initialProfile` liefert —
  // „only react to initialProfile changes", jetzt ohne Effekt.
  const [override, setOverride] = useState<{
    base: string | null | undefined;
    value: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const profile =
    override && override.base === initialProfile
      ? override.value
      : (initialProfile ?? "standard");

  const change = useCallback(
    async (v: string) => {
      const prev = override;
      setOverride({ base: initialProfile, value: v });
      setPending(true);
      try {
        const resp = await fetch(`/api/v1/processes/${processId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ complianceProfile: v }),
        });
        if (!resp.ok) {
          // Fallback to PUT if PATCH not supported
          const put = await fetch(`/api/v1/processes/${processId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ complianceProfile: v }),
          });
          if (!put.ok) {
            throw new Error("Update failed");
          }
        }
        toast.success(`Profil: ${PROFILES.find((p) => p.value === v)?.label}`);
        onChange?.(v);
      } catch (e) {
        toast.error((e as Error).message);
        setOverride(prev);
      } finally {
        setPending(false);
      }
    },
    [processId, initialProfile, override, onChange],
  );

  return (
    <div className="inline-flex items-center gap-2">
      <Layers className="h-4 w-4 text-muted-foreground" />
      <Select value={profile} onValueChange={change} disabled={pending}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROFILES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
