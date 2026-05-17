"use client";

// BPM Overhaul Phase 8: Value Stream Map view.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, GitMerge, Hourglass, TrendingUp } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Vsm {
  id: string;
  mapType: "current" | "future" | string;
  title: string;
  totalLeadTimeMinutes: string | null;
  totalValueAddMinutes: string | null;
  valueAddRatio: string | null;
  wasteAnalysis: Array<{ type: string; description: string; impact?: string }>;
  status: string;
  createdAt: string;
}

export default function VsmPage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const [maps, setMaps] = useState<Vsm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!processId) return;
    let cancel = false;
    (async () => {
      const resp = await fetch(`/api/v1/processes/${processId}/vsm`);
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setMaps(j.data ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
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

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitMerge className="h-6 w-6" /> Value Stream Maps
          </h1>
          <p className="text-sm text-muted-foreground">
            Current vs. future state with waste analysis (ISO 22301 / Lean)
          </p>
        </div>

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}

        {!loading && maps.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No value-stream maps yet for this process.
            </CardContent>
          </Card>
        )}

        {!loading && maps.map((m) => {
          const lead = m.totalLeadTimeMinutes ? parseFloat(m.totalLeadTimeMinutes) : 0;
          const va = m.totalValueAddMinutes ? parseFloat(m.totalValueAddMinutes) : 0;
          const ratio = m.valueAddRatio ? parseFloat(m.valueAddRatio) : 0;
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{m.title}</span>
                  <Badge variant="outline">{m.mapType === "current" ? "IS" : m.mapType === "future" ? "SOLL" : m.mapType}</Badge>
                </CardTitle>
                <CardDescription>
                  Status: {m.status} · Erstellt: {new Date(m.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <Metric
                    icon={<Hourglass className="h-4 w-4" />}
                    label="Lead Time"
                    value={`${(lead / 60).toFixed(1)} h`}
                  />
                  <Metric
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Value-Add"
                    value={`${(va / 60).toFixed(1)} h`}
                  />
                  <Metric
                    icon={<GitMerge className="h-4 w-4" />}
                    label="VA-Ratio"
                    value={`${ratio.toFixed(1)} %`}
                    tone={ratio >= 60 ? "ok" : ratio >= 30 ? "warn" : "bad"}
                  />
                </div>
                {(m.wasteAnalysis ?? []).length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Waste Analysis</h4>
                    <ul className="space-y-1">
                      {m.wasteAnalysis.map((w, i) => (
                        <li key={i} className="text-sm">
                          <Badge variant="outline" className="mr-2">
                            {w.type}
                          </Badge>
                          {w.description}
                          {w.impact && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Impact: {w.impact}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ModuleGate>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const c =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-foreground";
  return (
    <div className="rounded border p-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}
