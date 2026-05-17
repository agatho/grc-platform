"use client";

// BPM Overhaul Phase 4 C1: BIA-Processes overview with inline MTPD/RTO/RPO editor.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface ImpactRow {
  id?: string;
  processId: string;
  processName: string;
  department: string | null;
  mtpdHours: number | null;
  rtoHours: number | null;
  rpoHours: number | null;
  impact24h: string | null;
  impactOperational: number | null;
  impactFinancial: number | null;
  priorityRanking: number | null;
  isEssential: boolean;
}

export default function BiaProcessesPage() {
  const params = useParams<{ id: string }>();
  const biaId = params?.id ?? "";

  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    // Existing endpoint /api/v1/bcms/bia/[id]/impacts returns the impact rows
    const resp = await fetch(`/api/v1/bcms/bia/${biaId}/impacts`);
    if (resp.ok) {
      const j = await resp.json();
      const data = (j.data ?? []).map((d: any) => ({
        id: d.id,
        processId: d.processId,
        processName: d.processName ?? "(unbenannt)",
        department: d.department ?? null,
        mtpdHours: d.mtpdHours,
        rtoHours: d.rtoHours,
        rpoHours: d.rpoHours,
        impact24h: d.impact24h,
        impactOperational: d.impactOperational,
        impactFinancial: d.impactFinancial,
        priorityRanking: d.priorityRanking,
        isEssential: !!d.isEssential,
      }));
      setRows(data);
    }
    setLoading(false);
  }, [biaId]);

  useEffect(() => {
    if (biaId) reload();
  }, [biaId, reload]);

  const saveRow = useCallback(
    async (row: ImpactRow) => {
      setSavingId(row.processId);
      const resp = await fetch(`/api/v1/bcms/bia/${biaId}/impacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processId: row.processId,
          mtpdHours: row.mtpdHours,
          rtoHours: row.rtoHours,
          rpoHours: row.rpoHours,
          impactOperational: row.impactOperational,
          impactFinancial: row.impactFinancial,
          priorityRanking: row.priorityRanking,
          isEssential: row.isEssential,
        }),
      });
      if (resp.ok) {
        toast.success("Saved");
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "Save failed");
      }
      setSavingId(null);
    },
    [biaId],
  );

  const update = (i: number, patch: Partial<ImpactRow>) => {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  return (
    <ModuleGate moduleKey="bcms">
      <div className="space-y-4 p-4">
        <Link
          href={`/bcms/bia/${biaId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück zur BIA
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Prozesse in dieser BIA</CardTitle>
            <CardDescription>MTPD / RTO / RPO und Impact-Werte pro Prozess</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            ) : rows.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Keine Prozesse in dieser BIA gescored.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="px-2 py-2">Prozess</th>
                      <th className="px-2 py-2">Abteilung</th>
                      <th className="px-2 py-2">MTPD (h)</th>
                      <th className="px-2 py-2">RTO (h)</th>
                      <th className="px-2 py-2">RPO (h)</th>
                      <th className="px-2 py-2">Op (1-5)</th>
                      <th className="px-2 py-2">Fin (1-5)</th>
                      <th className="px-2 py-2">Prio</th>
                      <th className="px-2 py-2">Essential</th>
                      <th className="px-2 py-2">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.processId} className="border-b">
                        <td className="px-2 py-1">
                          <Link
                            href={`/processes/${r.processId}`}
                            className="hover:underline"
                          >
                            {r.processName}
                          </Link>
                        </td>
                        <td className="px-2 py-1 text-xs text-muted-foreground">
                          {r.department ?? "—"}
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.mtpdHours}
                            onChange={(v) => update(i, { mtpdHours: v })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.rtoHours}
                            onChange={(v) => update(i, { rtoHours: v })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.rpoHours}
                            onChange={(v) => update(i, { rpoHours: v })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.impactOperational}
                            onChange={(v) => update(i, { impactOperational: v })}
                            min={0}
                            max={5}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.impactFinancial}
                            onChange={(v) => update(i, { impactFinancial: v })}
                            min={0}
                            max={5}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <NumCell
                            value={r.priorityRanking}
                            onChange={(v) => update(i, { priorityRanking: v })}
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Switch
                            checked={r.isEssential}
                            onCheckedChange={(v) => update(i, { isEssential: v })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveRow(r)}
                            disabled={savingId === r.processId}
                          >
                            {savingId === r.processId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
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

function NumCell({
  value,
  onChange,
  min,
  max,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      className="h-7 w-20 px-1 text-sm"
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(null);
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
