"use client";

// BPM Overhaul Phase 4 C2: Compliance Profile dropdown.
// Toggles which set of fields the process detail page foregrounds.

import { useCallback, useEffect, useState } from "react";
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
  const [profile, setProfile] = useState(initialProfile ?? "standard");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialProfile && initialProfile !== profile) setProfile(initialProfile);
    // Only react to initialProfile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfile]);

  const change = useCallback(
    async (v: string) => {
      const prev = profile;
      setProfile(v);
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
        setProfile(prev);
      } finally {
        setPending(false);
      }
    },
    [processId, profile, onChange],
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
