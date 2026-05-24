"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Clock, Activity, AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

interface BiaImpact {
  id: string;
  biaAssessmentId: string;
  biaName: string;
  biaStatus: string;
  mtpdHours: number | null;
  rtoHours: number | null;
  rpoHours: number | null;
  impact24h: string | null;
  impact72h: string | null;
  impactReputation: number | null;
  impactOperational: number | null;
  impactFinancial: number | null;
  impactSafety: number | null;
  priorityRanking: number | null;
  isEssential: boolean;
  assessedAt: string | null;
}

function fmtHours(h: number | null) {
  if (h == null) return "—";
  if (h >= 24) return `${(h / 24).toFixed(1)}d`;
  return `${h}h`;
}

export function ProcessBiaTab({ processId }: { processId: string }) {
  const { formatDate } = useDateFormat();
  const [impacts, setImpacts] = useState<BiaImpact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const resp = await fetch(`/api/v1/processes/${processId}/bia-impacts`);
      if (resp.ok) {
        const j = await resp.json();
        if (!cancel) setImpacts(j.data ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [processId]);

  if (loading) {
    return (
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    );
  }

  if (impacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This process is not yet scored in any BIA.
          <br />
          <Link
            href="/bcms/bia/new"
            className="mt-2 inline-block text-primary underline"
          >
            Start a BIA →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isCritical = impacts.some(
    (i) =>
      i.isEssential ||
      (i.priorityRanking !== null && i.priorityRanking <= 2) ||
      (i.rtoHours !== null && i.rtoHours <= 4),
  );

  return (
    <div className="space-y-4">
      {isCritical && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          This process is flagged as <strong>critical</strong> in at least one
          BIA. Ensure NIS2/DORA downstream dashboards are reviewed.
        </div>
      )}
      {impacts.map((i) => (
        <Card key={i.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Link
                href={`/bcms/bia/${i.biaAssessmentId}`}
                className="hover:underline"
              >
                {i.biaName}
              </Link>
              <Badge variant="outline">{i.biaStatus}</Badge>
            </CardTitle>
            {i.assessedAt && (
              <CardDescription>
                Assessed {formatDate(i.assessedAt)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Metric
                icon={<Clock className="h-4 w-4" />}
                label="MTPD"
                value={fmtHours(i.mtpdHours)}
              />
              <Metric
                icon={<Activity className="h-4 w-4" />}
                label="RTO"
                value={fmtHours(i.rtoHours)}
              />
              <Metric
                icon={<Activity className="h-4 w-4" />}
                label="RPO"
                value={fmtHours(i.rpoHours)}
              />
              <Metric
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Priority"
                value={i.priorityRanking?.toString() ?? "—"}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <ImpactScore label="Reputation" value={i.impactReputation} />
              <ImpactScore label="Operational" value={i.impactOperational} />
              <ImpactScore label="Financial" value={i.impactFinancial} />
              <ImpactScore label="Safety" value={i.impactSafety} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {i.impact24h && (
                <div>
                  <span className="text-muted-foreground">Impact @24h:</span>{" "}
                  <strong>€{parseFloat(i.impact24h).toLocaleString()}</strong>
                </div>
              )}
              {i.impact72h && (
                <div>
                  <span className="text-muted-foreground">Impact @72h:</span>{" "}
                  <strong>€{parseFloat(i.impact72h).toLocaleString()}</strong>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border p-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function ImpactScore({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const color =
    value == null
      ? "text-muted-foreground"
      : value >= 4
        ? "text-red-600"
        : value === 3
          ? "text-amber-600"
          : "text-emerald-600";
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={`font-semibold ${color}`}>{value ?? "—"}/5</span>
    </div>
  );
}
