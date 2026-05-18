"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Download,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
} from "lucide-react";

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

interface RacmRow {
  stepId: string;
  bpmnElementId: string;
  stepName: string | null;
  lineOfDefense: string | null;
  risks: Array<{
    id: string;
    title: string;
    inherent: number | null;
    residual: number | null;
    status: string;
  }>;
  controls: Array<{
    id: string;
    title: string;
    status: string;
    controlType: string;
    automationLevel: string;
    latestToeResult: string | null;
    latestTestDate: string | null;
  }>;
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
}

interface RacmResponse {
  processId: string;
  processName: string;
  rows: RacmRow[];
  counts: Record<string, number>;
}

const sevBadge: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

const ctrlStatusBadge: Record<string, string> = {
  effective: "bg-emerald-100 text-emerald-800",
  ineffective: "bg-red-100 text-red-800",
  implemented: "bg-blue-100 text-blue-800",
  designed: "bg-amber-100 text-amber-800",
};

function residualBg(score: number | null): string {
  if (score == null) return "";
  if (score >= 15) return "bg-red-50";
  if (score >= 9) return "bg-amber-50";
  if (score >= 4) return "bg-yellow-50";
  return "bg-emerald-50";
}

export default function RacmPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const [data, setData] = useState<RacmResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!processId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const resp = await fetch(`/api/v1/processes/${processId}/racm`);
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setData(j.data);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [processId]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [
      "Activity,LineOfDefense,Risk,Inherent,Residual,Control,ControlStatus,ToE,Finding,FindingSeverity",
    ];
    for (const r of data.rows) {
      const maxN = Math.max(
        r.risks.length,
        r.controls.length,
        r.findings.length,
        1,
      );
      for (let i = 0; i < maxN; i++) {
        const risk = r.risks[i];
        const ctrl = r.controls[i];
        const find = r.findings[i];
        lines.push(
          [
            i === 0 ? csv(r.stepName ?? r.bpmnElementId) : "",
            i === 0 ? csv(r.lineOfDefense ?? "") : "",
            csv(risk?.title ?? ""),
            risk?.inherent?.toString() ?? "",
            risk?.residual?.toString() ?? "",
            csv(ctrl?.title ?? ""),
            csv(ctrl?.status ?? ""),
            csv(ctrl?.latestToeResult ?? ""),
            csv(find?.title ?? ""),
            csv(find?.severity ?? ""),
          ].join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `racm-${processId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/processes/${processId}`}
            className="flex items-center text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to process
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={!data}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>RACM — Risk and Control Matrix</CardTitle>
            <CardDescription>
              {data?.processName ?? "…"}
              {data && (
                <span className="ml-3 text-xs">
                  {data.counts.totalActivities} activities ·{" "}
                  {data.counts.totalRisks} risks · {data.counts.totalControls}{" "}
                  controls · {data.counts.totalFindings} findings
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            )}
            {!loading && data && data.rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                This process has no activities yet.
              </p>
            )}
            {!loading && data && data.rows.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="px-3 py-2">Activity</th>
                      <th className="px-3 py-2">LoD</th>
                      <th className="px-3 py-2">Risks</th>
                      <th className="px-3 py-2">Controls</th>
                      <th className="px-3 py-2">Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => {
                      const maxResidual = r.risks.reduce(
                        (a, x) => Math.max(a, x.residual ?? 0),
                        0,
                      );
                      return (
                        <tr
                          key={r.stepId}
                          className={`border-b align-top ${residualBg(maxResidual || null)}`}
                        >
                          <td className="px-3 py-2 font-medium">
                            {r.stepName ?? r.bpmnElementId}
                          </td>
                          <td className="px-3 py-2">
                            {r.lineOfDefense ? (
                              <Badge variant="outline">{r.lineOfDefense}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.risks.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                No risks
                              </span>
                            ) : (
                              <ul className="space-y-1">
                                {r.risks.map((risk) => (
                                  <li
                                    key={risk.id}
                                    className="flex items-center gap-2"
                                  >
                                    <ShieldAlert className="h-3 w-3 text-amber-600" />
                                    <Link
                                      href={`/risks/${risk.id}`}
                                      className="hover:underline"
                                    >
                                      {risk.title}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                      I:{risk.inherent ?? "—"} R:
                                      {risk.residual ?? "—"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.controls.length === 0 ? (
                              <span className="text-xs text-red-600">
                                No controls
                              </span>
                            ) : (
                              <ul className="space-y-1">
                                {r.controls.map((ctrl) => (
                                  <li
                                    key={ctrl.id}
                                    className="flex items-center gap-2"
                                  >
                                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                    <Link
                                      href={`/controls/${ctrl.id}`}
                                      className="hover:underline"
                                    >
                                      {ctrl.title}
                                    </Link>
                                    <Badge
                                      variant="outline"
                                      className={
                                        ctrlStatusBadge[ctrl.status] ?? ""
                                      }
                                    >
                                      {ctrl.status}
                                    </Badge>
                                    {ctrl.latestToeResult && (
                                      <span className="text-xs text-muted-foreground">
                                        ToE: {ctrl.latestToeResult}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.findings.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <ul className="space-y-1">
                                {r.findings.map((f) => (
                                  <li
                                    key={f.id}
                                    className="flex items-center gap-2"
                                  >
                                    <AlertOctagon className="h-3 w-3 text-red-600" />
                                    <Link
                                      href={`/findings/${f.id}`}
                                      className="hover:underline"
                                    >
                                      {f.title}
                                    </Link>
                                    <Badge
                                      className={sevBadge[f.severity] ?? ""}
                                    >
                                      {f.severity}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}

function csv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
