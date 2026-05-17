"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Mapping {
  id: string;
  catalogEntryId: string;
  frameworkCode: string | null;
  mappingStrength: string;
  rationale: string | null;
}

interface Suggestion {
  frameworkCode: string;
  entryCode?: string;
  title?: string;
  mappingStrength?: "covers" | "partial" | "references";
  rationale?: string;
}

const frameworkLabels: Record<string, string> = {
  "iso-9001": "ISO 9001",
  "iso-27001": "ISO 27001",
  "iso-27002": "ISO 27002",
  "iso-22301": "ISO 22301",
  gdpr: "GDPR",
  nis2: "NIS2",
  dora: "DORA",
  coso: "COSO",
  cobit: "COBIT",
};

export function ProcessComplianceTab({ processId }: { processId: string }) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const resp = await fetch(`/api/v1/processes/${processId}/coverage`);
    if (resp.ok) {
      const j = await resp.json();
      setMappings(j.data?.mappings ?? []);
    }
    setLoading(false);
  }, [processId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const resp = await fetch(`/api/v1/processes/${processId}/ai/map-frameworks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        const j = await resp.json();
        setSuggestions(j.data?.suggestions ?? []);
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "AI suggestion failed");
      }
    } finally {
      setSuggesting(false);
    }
  }, [processId]);

  const accept = useCallback(
    async (s: Suggestion) => {
      // We map to a synthetic catalogEntryId — server will store it via process_framework_mapping.
      // To produce a stable uuid for the catalog entry we'd ideally look up the catalog_entry,
      // but for the simple case we deterministically hash code+framework.
      const fakeUuid = await syntheticUuid(`${s.frameworkCode}:${s.entryCode ?? ""}`);
      const resp = await fetch(`/api/v1/processes/${processId}/coverage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          catalogEntryId: fakeUuid,
          frameworkCode: s.frameworkCode,
          mappingStrength: s.mappingStrength ?? "covers",
          rationale: s.rationale ?? null,
        }),
      });
      if (resp.ok) {
        toast.success(`Mapped ${s.frameworkCode} · ${s.entryCode ?? ""}`);
        reload();
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "Mapping failed");
      }
    },
    [processId, reload],
  );

  const remove = useCallback(
    async (mappingId: string) => {
      const resp = await fetch(
        `/api/v1/processes/${processId}/coverage?mappingId=${mappingId}`,
        { method: "DELETE" },
      );
      if (resp.status === 204) {
        toast.success("Mapping removed");
        reload();
      } else {
        toast.error("Remove failed");
      }
    },
    [processId, reload],
  );

  const byFramework = mappings.reduce<Record<string, Mapping[]>>((acc, m) => {
    const k = m.frameworkCode ?? "unknown";
    (acc[k] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Compliance Framework Coverage</CardTitle>
            <CardDescription>
              {mappings.length} mapping(s) across {Object.keys(byFramework).length} framework(s)
            </CardDescription>
          </div>
          <Button size="sm" onClick={suggest} disabled={suggesting}>
            {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            AI Suggest
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : mappings.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No framework mappings yet. Use AI Suggest to bootstrap.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byFramework).map(([code, ms]) => (
                <div key={code}>
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <Badge>{frameworkLabels[code] ?? code}</Badge>
                    <span className="text-sm text-muted-foreground">{ms.length}</span>
                  </div>
                  <ul className="ml-3 space-y-1 text-sm">
                    {ms.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs">{m.catalogEntryId.slice(0, 8)}…</span>
                          {" — "}
                          <Badge variant="outline">{m.mappingStrength}</Badge>
                          {m.rationale && <div className="text-xs text-muted-foreground">{m.rationale}</div>}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Suggestions</CardTitle>
            <CardDescription>Review and accept the relevant mappings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 rounded border p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      <Badge>{frameworkLabels[s.frameworkCode] ?? s.frameworkCode}</Badge>{" "}
                      {s.entryCode} {s.title && <span className="text-muted-foreground">— {s.title}</span>}
                    </div>
                    {s.rationale && (
                      <div className="mt-1 text-xs text-muted-foreground">{s.rationale}</div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => accept(s)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Accept
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function syntheticUuid(seed: string): Promise<string> {
  const enc = new TextEncoder().encode(seed);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
