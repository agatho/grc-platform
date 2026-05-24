"use client";

// BPM Overhaul Phase 8: Maturity Breakdown page (CMMI-style).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft, RefreshCw, Award } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

interface DimensionScore {
  dimension: string;
  level: number;
  basis: string;
}

interface MaturityResult {
  id: string;
  overall: number;
  overallLevel?: number;
  assessmentDate: string;
  dimensions: DimensionScore[];
}

const LEVEL_LABELS = [
  "—",
  "Initial",
  "Repeatable",
  "Defined",
  "Managed",
  "Optimizing",
];

function levelColor(level: number): string {
  if (level >= 5) return "bg-emerald-100 text-emerald-800";
  if (level >= 4) return "bg-blue-100 text-blue-800";
  if (level >= 3) return "bg-amber-100 text-amber-800";
  if (level >= 2) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

const DIMENSION_LABELS: Record<string, string> = {
  control_coverage: "Control Coverage",
  control_effectiveness: "Control Effectiveness",
  kpi_performance: "KPI Performance",
  audit_health: "Audit Health",
  documentation_completeness: "Documentation Completeness",
};

export default function MaturityPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const { formatDate } = useDateFormat();

  const [result, setResult] = useState<MaturityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    // History is in process_maturity_assessment — read the most recent via the legacy endpoint
    const resp = await fetch(
      `/api/v1/processes/${processId}/maturity-history?limit=1`,
    );
    if (resp.ok) {
      const j = await resp.json();
      const latest = (j.data ?? [])[0];
      if (latest) {
        setResult({
          id: latest.id,
          overall: latest.overallLevel,
          overallLevel: latest.overallLevel,
          assessmentDate: latest.assessmentDate,
          dimensions: latest.dimensionScores ?? [],
        });
      }
    }
    setLoading(false);
  }, [processId]);

  useEffect(() => {
    if (processId) reload();
  }, [processId, reload]);

  const compute = useCallback(async () => {
    setComputing(true);
    try {
      const resp = await fetch(
        `/api/v1/processes/${processId}/maturity/auto-compute`,
        { method: "POST" },
      );
      if (resp.ok) {
        const j = await resp.json();
        setResult({
          id: j.data.id,
          overall: j.data.overall,
          overallLevel: j.data.overall,
          assessmentDate:
            j.data.assessmentDate ?? new Date().toISOString().slice(0, 10),
          dimensions: j.data.dimensions ?? [],
        });
        toast.success(
          `Maturity Level ${j.data.overall}: ${LEVEL_LABELS[j.data.overall] ?? ""}`,
        );
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "Compute failed");
      }
    } finally {
      setComputing(false);
    }
  }, [processId]);

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <Link
          href={`/processes/${processId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to process
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" /> Process Maturity (CMMI)
          </h1>
          <Button onClick={compute} disabled={computing}>
            {computing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Compute now
          </Button>
        </div>

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}

        {!loading && !result && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No maturity assessment yet. Click "Compute now" to derive one from
              live data.
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Overall Level
                  <Badge className={levelColor(result.overall)}>
                    L{result.overall}: {LEVEL_LABELS[result.overall] ?? "?"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Last computed {formatDate(result.assessmentDate)}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dimensions</CardTitle>
                <CardDescription>5 live-computed scoring axes</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.dimensions.map((d) => (
                    <li key={d.dimension} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {DIMENSION_LABELS[d.dimension] ?? d.dimension}
                        </span>
                        <Badge className={levelColor(d.level)}>
                          L{d.level}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {d.basis}
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full rounded bg-blue-500"
                          style={{ width: `${(d.level / 5) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ModuleGate>
  );
}
