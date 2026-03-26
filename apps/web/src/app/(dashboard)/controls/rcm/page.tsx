"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2, RefreshCcw, Grid3X3, AlertTriangle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RcmRisk {
  id: string;
  title: string;
  riskCategory: string;
  riskScoreResidual?: number;
}

interface RcmControl {
  id: string;
  title: string;
}

interface RcmCell {
  riskId: string;
  controlId: string;
  effectiveness: "full" | "partial" | "planned" | "none";
}

interface RcmData {
  risks: RcmRisk[];
  controls: RcmControl[];
  cells: RcmCell[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function effectivenessColor(eff: string): string {
  const map: Record<string, string> = {
    full: "bg-emerald-500 hover:bg-emerald-600",
    partial: "bg-yellow-500 hover:bg-yellow-600",
    planned: "bg-blue-500 hover:bg-blue-600",
    none: "bg-red-500 hover:bg-red-600",
  };
  return map[eff] ?? "bg-gray-300";
}

function effectivenessLabel(eff: string, t: ReturnType<typeof useTranslations>): string {
  return t(`rcm.effectiveness.${eff}`);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RcmPage() {
  return (
    <ModuleGate moduleKey="ics">
      <RcmPageInner />
    </ModuleGate>
  );
}

function RcmPageInner() {
  const t = useTranslations("controls");
  const [data, setData] = useState<RcmData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRcm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/controls/rcm");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRcm();
  }, [fetchRcm]);

  const cellMap = useMemo(() => {
    const map = new Map<string, RcmCell>();
    if (data) {
      for (const cell of data.cells) {
        map.set(`${cell.riskId}::${cell.controlId}`, cell);
      }
    }
    return map;
  }, [data]);

  // Gap risks: risks with no "full" coverage
  const gapRiskIds = useMemo(() => {
    if (!data) return new Set<string>();
    const covered = new Set<string>();
    for (const cell of data.cells) {
      if (cell.effectiveness === "full") covered.add(cell.riskId);
    }
    return new Set(data.risks.filter((r) => !covered.has(r.id)).map((r) => r.id));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("rcm.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("rcm.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRcm()} disabled={loading}>
          <RefreshCcw size={14} />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {["full", "partial", "planned", "none"].map((eff) => (
          <div key={eff} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${effectivenessColor(eff)}`} />
            <span className="text-xs text-gray-600">{effectivenessLabel(eff, t)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <AlertTriangle size={12} className="text-red-500" />
          <span className="text-xs text-gray-600">{t("rcm.gap")}</span>
        </div>
      </div>

      {/* Matrix */}
      {!data || data.risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Grid3X3 size={28} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("rcm.empty")}</p>
        </div>
      ) : (
        <Card>
          <CardContent className="py-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-10 text-left text-xs font-medium text-gray-500 uppercase pb-2 pr-4 min-w-[200px]">
                    {t("rcm.riskColumn")}
                  </th>
                  {data.controls.map((ctrl) => (
                    <th key={ctrl.id} className="text-center text-[10px] font-medium text-gray-500 pb-2 px-1 min-w-[80px]">
                      <Link href={`/controls/${ctrl.id}`} className="hover:text-blue-600 hover:underline">
                        {ctrl.title.length > 20 ? `${ctrl.title.slice(0, 20)}...` : ctrl.title}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.risks.map((risk) => {
                  const isGap = gapRiskIds.has(risk.id);
                  return (
                    <tr key={risk.id} className={`border-t border-gray-100 ${isGap ? "bg-red-50/50" : ""}`}>
                      <td className="sticky left-0 bg-white z-10 py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          {isGap && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                          <Link
                            href={`/risks/${risk.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline truncate max-w-[180px]"
                          >
                            {risk.title}
                          </Link>
                        </div>
                      </td>
                      {data.controls.map((ctrl) => {
                        const cell = cellMap.get(`${risk.id}::${ctrl.id}`);
                        return (
                          <td key={ctrl.id} className="py-2 px-1 text-center">
                            {cell ? (
                              <span
                                className={`inline-block h-6 w-6 rounded ${effectivenessColor(cell.effectiveness)} cursor-pointer transition-colors`}
                                title={effectivenessLabel(cell.effectiveness, t)}
                              />
                            ) : (
                              <span className="inline-block h-6 w-6 rounded bg-gray-100" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
