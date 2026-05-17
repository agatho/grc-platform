"use client";

// BPM Overhaul Phase 8: Process mining dashboard.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Activity,
  AlertTriangle,
  TrendingDown,
  RotateCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface Bottleneck {
  activity: string;
  occurrences: number;
  median_wait_seconds: number;
}
interface FitnessGap {
  activity: string;
  count: number;
}
interface ReworkLoop {
  activity: string;
  repeatOccurrences: number;
}
interface ConformanceRow {
  import_name: string;
  imported_at: string;
  conformance_score: string;
  total_traces: number;
  conformant_traces: number;
  fitness_gaps: FitnessGap[];
  bottlenecks: Bottleneck[];
  rework_loops: ReworkLoop[];
  computed_at: string;
}

export default function ProcessMiningPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const [rows, setRows] = useState<ConformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!processId) return;
    let cancel = false;
    (async () => {
      const resp = await fetch(`/api/v1/processes/${processId}/mining/bottlenecks`);
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setRows(j.data ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [processId]);

  const latest = rows[0];
  const score = latest ? parseFloat(latest.conformance_score) : 0;
  const band =
    score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "at_risk" : "critical";
  const scoreColor =
    band === "excellent"
      ? "text-emerald-700"
      : band === "good"
        ? "text-blue-700"
        : band === "at_risk"
          ? "text-amber-700"
          : "text-red-700";

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <Link
          href={`/processes/${processId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to process
        </Link>

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}

        {!loading && rows.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No conformance results yet. Ingest event logs via
              <code className="ml-1">POST /api/v1/processes/{processId}/event-logs</code>
              and the conformance worker will compute results.
            </CardContent>
          </Card>
        )}

        {latest && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">Conformance</div>
                  <div className={`text-4xl font-bold ${scoreColor}`}>
                    {score.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">{band}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">Traces</div>
                  <div className="text-4xl font-bold">{latest.total_traces}</div>
                  <div className="text-xs text-muted-foreground">
                    {latest.conformant_traces} conformant
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">Fitness gaps</div>
                  <div className="text-4xl font-bold text-amber-700">
                    {latest.fitness_gaps?.length ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">unmodeled activities</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">Rework loops</div>
                  <div className="text-4xl font-bold text-red-700">
                    {latest.rework_loops?.length ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">repeated activities</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" /> Bottlenecks (median wait time)
                </CardTitle>
                <CardDescription>Top 10 activities by median wait time</CardDescription>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                {(latest.bottlenecks?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No bottlenecks detected.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latest.bottlenecks}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="activity"
                        tick={{ fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        tickFormatter={(v) => `${Math.round(v / 60)}m`}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v: any) => `${Math.round(Number(v) / 60)} min`} />
                      <Bar dataKey="median_wait_seconds" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" /> Fitness gaps
                  </CardTitle>
                  <CardDescription>Activities in log not modeled in BPMN</CardDescription>
                </CardHeader>
                <CardContent>
                  {(latest.fitness_gaps?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">None — model matches log.</p>
                  ) : (
                    <ul className="space-y-1">
                      {latest.fitness_gaps.map((g) => (
                        <li key={g.activity} className="flex justify-between text-sm">
                          <span>{g.activity}</span>
                          <span className="font-mono text-muted-foreground">{g.count}×</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RotateCw className="h-4 w-4" /> Rework loops
                  </CardTitle>
                  <CardDescription>Activities repeated within a single case</CardDescription>
                </CardHeader>
                <CardContent>
                  {(latest.rework_loops?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">None — clean traces.</p>
                  ) : (
                    <ul className="space-y-1">
                      {latest.rework_loops.map((g) => (
                        <li key={g.activity} className="flex justify-between text-sm">
                          <span>{g.activity}</span>
                          <span className="font-mono text-muted-foreground">
                            {g.repeatOccurrences}×
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {rows.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" /> History
                  </CardTitle>
                  <CardDescription>Last {rows.length} conformance runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr>
                        <th className="pb-2">Run</th>
                        <th className="pb-2">When</th>
                        <th className="pb-2">Score</th>
                        <th className="pb-2">Traces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1">{r.import_name}</td>
                          <td className="py-1 text-muted-foreground">
                            {new Date(r.computed_at).toLocaleString()}
                          </td>
                          <td className="py-1 font-mono">
                            {parseFloat(r.conformance_score).toFixed(1)}%
                          </td>
                          <td className="py-1">{r.total_traces}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ModuleGate>
  );
}
