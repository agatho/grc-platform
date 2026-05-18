"use client";

// BPM Overhaul Phase 6 P6: Audit-trail tab — surfaces audit_log entries
// for the process and its children, including sign-off hash refs.

import { useEffect, useState } from "react";
import { Loader2, History } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TrailEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  action_detail: string | null;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const actionColor: Record<string, string> = {
  insert: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
};

const entityTypeLabel: Record<string, string> = {
  process: "Process",
  process_version: "Version",
  process_step: "Step",
  process_sign_off: "Sign-off",
  process_risk: "Risk link",
  process_step_risk: "Step-Risk link",
  process_control: "Control link",
  process_step_control: "Step-Control link",
  process_document: "Document link",
  process_asset: "Asset link",
  process_ropa_profile: "ROPA",
  process_framework_mapping: "Framework mapping",
};

export function ProcessAuditTrailTab({ processId }: { processId: string }) {
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const resp = await fetch(
        `/api/v1/processes/${processId}/audit-trail?limit=300`,
      );
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setEntries(j.data ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [processId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Audit-Trail
        </CardTitle>
        <CardDescription>
          {entries.length} Eintrag/-träge inkl. Sign-off-Hash-Ankern
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Keine Einträge.
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={actionColor[e.action] ?? "bg-gray-100"}>
                      {e.action}
                    </Badge>
                    <span className="font-medium">
                      {entityTypeLabel[e.entity_type] ?? e.entity_type}
                    </span>
                    {e.action_detail && (
                      <span className="text-muted-foreground">
                        — {e.action_detail}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {e.user_name ?? e.user_email ?? e.user_id?.slice(0, 8)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
