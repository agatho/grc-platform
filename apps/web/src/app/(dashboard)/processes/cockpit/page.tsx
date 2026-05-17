"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CockpitData {
  stats: {
    draft: number;
    in_review: number;
    approved: number;
    published: number;
    archived: number;
    critical_processes: number;
    total: number;
  };
  quadrants: {
    inReview: any[];
    pendingApproval: any[];
    overdueReview: any[];
    criticalRisks: any[];
  };
}

export default function CockpitPage() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const resp = await fetch(`/api/v1/processes/cockpit`);
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setData(j.data);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold">Process Cockpit</h1>
          <p className="text-sm text-muted-foreground">
            Quality Manager & Compliance Officer daily-driver dashboard
          </p>
        </div>

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Total" value={data.stats.total} />
              <StatCard label="Draft" value={data.stats.draft} />
              <StatCard label="In Review" value={data.stats.in_review} tone="info" />
              <StatCard label="Approved" value={data.stats.approved} tone="warn" />
              <StatCard label="Published" value={data.stats.published} tone="ok" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Quadrant
                title="In Review"
                icon={<Activity className="h-5 w-5 text-blue-600" />}
                rows={data.quadrants.inReview}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      Owner: {r.owner_name ?? "—"} · Reviewer: {r.reviewer_name ?? "—"}
                    </div>
                  </>
                )}
              />
              <Quadrant
                title="Pending Approval (Quality Manager)"
                icon={<CheckCircle2 className="h-5 w-5 text-amber-600" />}
                rows={data.quadrants.pendingApproval}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      Owner: {r.owner_name ?? "—"}
                    </div>
                  </>
                )}
              />
              <Quadrant
                title="Overdue Reviews"
                icon={<Clock className="h-5 w-5 text-red-600" />}
                rows={data.quadrants.overdueReview}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      Owner: {r.owner_name ?? "—"} · Due:{" "}
                      {r.review_date ? new Date(r.review_date).toLocaleDateString() : "—"}
                    </div>
                  </>
                )}
              />
              <Quadrant
                title="Processes with Critical Risks"
                icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
                rows={data.quadrants.criticalRisks}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <Badge className="ml-2 bg-red-600 text-white">
                      {r.critical_count} critical
                    </Badge>
                  </>
                )}
              />
            </div>
          </>
        )}
      </div>
    </ModuleGate>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "info" | "warn" | "ok";
}) {
  const color =
    tone === "info"
      ? "text-blue-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Quadrant({
  title,
  icon,
  rows,
  renderRow,
}: {
  title: string;
  icon: React.ReactNode;
  rows: any[];
  renderRow: (r: any) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{rows.length} item(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Nothing here. </p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-auto">
            {rows.slice(0, 25).map((r, i) => (
              <li key={i} className="rounded p-2 hover:bg-muted">
                <Link href={`/processes/${r.id}`} className="block">
                  {renderRow(r)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
