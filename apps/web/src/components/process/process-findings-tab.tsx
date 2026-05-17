"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertOctagon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  status: string;
  source: string;
  link_via: string;
  process_step_id: string | null;
  control_id: string | null;
  remediation_due_date: string | null;
  created_at: string;
}

const sevColor: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

export function ProcessFindingsTab({ processId }: { processId: string }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const resp = await fetch(`/api/v1/processes/${processId}/findings`);
      if (resp.ok) {
        const j = await resp.json();
        if (!cancel) setFindings(j.data ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [processId]);

  if (loading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />;

  if (findings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No findings tied to this process.
        </CardContent>
      </Card>
    );
  }

  const open = findings.filter((f) => !["closed", "verified", "remediated"].includes(f.status));
  const closed = findings.filter((f) => ["closed", "verified", "remediated"].includes(f.status));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5" />
            Open findings ({open.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">All clear.</p>
          ) : (
            <FindingList findings={open} />
          )}
        </CardContent>
      </Card>
      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Closed / Remediated ({closed.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <FindingList findings={closed} dim />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FindingList({ findings, dim }: { findings: Finding[]; dim?: boolean }) {
  return (
    <ul className="divide-y">
      {findings.map((f) => (
        <li key={f.id} className={`py-2 ${dim ? "opacity-70" : ""}`}>
          <div className="flex items-center justify-between">
            <Link href={`/findings/${f.id}`} className="font-medium hover:underline">
              {f.title}
            </Link>
            <Badge className={sevColor[f.severity] ?? "bg-gray-100"}>{f.severity}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            via <em>{f.link_via}</em> · {f.status} · {f.source}
            {f.remediation_due_date && ` · due ${new Date(f.remediation_due_date).toLocaleDateString()}`}
          </div>
        </li>
      ))}
    </ul>
  );
}
