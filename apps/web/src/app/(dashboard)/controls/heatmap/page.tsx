"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Grid3X3 } from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeatmapCell {
  controlType: string;
  frequency: string;
  avgScore: number;
  controlCount: number;
  minScore: number;
  maxScore: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTROL_TYPES = ["preventive", "detective", "corrective"];
const FREQUENCIES = [
  "event_driven",
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
  "ad_hoc",
];

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500 text-white";
  if (score >= 60) return "bg-green-300 text-green-900";
  if (score >= 50) return "bg-yellow-400 text-yellow-900";
  if (score >= 30) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function scoreBgStyle(score: number): string {
  if (score >= 80) return "rgba(34, 197, 94, 0.8)";
  if (score >= 60) return "rgba(134, 239, 172, 0.7)";
  if (score >= 50) return "rgba(250, 204, 21, 0.7)";
  if (score >= 30) return "rgba(251, 146, 60, 0.7)";
  return "rgba(239, 68, 68, 0.8)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CesHeatmapPage() {
  const t = useTranslations("intelligence");
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ics/ces/heatmap");
      if (!res.ok) throw new Error("Failed to load heatmap data");
      const json = await res.json();
      setCells(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build lookup map
  const cellMap = new Map<string, HeatmapCell>();
  for (const cell of cells) {
    cellMap.set(`${cell.controlType}-${cell.frequency}`, cell);
  }

  return (
    <ModuleGate moduleKey="ics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Grid3X3 className="h-6 w-6" />
              {t("ces.heatmapTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("ces.heatmapDescription")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("ces.refresh")}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading && !error ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("ces.heatmapMatrixTitle")}</CardTitle>
              <CardDescription>
                {t("ces.heatmapMatrixDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-sm font-medium text-muted-foreground border-b">
                        {t("ces.controlType")}
                      </th>
                      {FREQUENCIES.map((freq) => (
                        <th
                          key={freq}
                          className="p-2 text-center text-xs font-medium text-muted-foreground border-b"
                        >
                          {t(`ces.freq.${freq}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CONTROL_TYPES.map((type) => (
                      <tr key={type}>
                        <td className="p-2 text-sm font-medium border-b">
                          {t(`ces.type.${type}`)}
                        </td>
                        {FREQUENCIES.map((freq) => {
                          const cell = cellMap.get(`${type}-${freq}`);
                          if (!cell) {
                            return (
                              <td
                                key={freq}
                                className="p-2 text-center border-b"
                              >
                                <span className="text-xs text-muted-foreground">
                                  --
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={freq} className="p-1 border-b">
                              <Link
                                href={`/controls?type=${type}&frequency=${freq}`}
                                className={`block rounded-md p-2 text-center transition-opacity hover:opacity-80 ${scoreColor(cell.avgScore)}`}
                                style={{
                                  minWidth: `${Math.max(40, Math.min(80, cell.controlCount * 10))}px`,
                                }}
                              >
                                <div className="text-lg font-bold">
                                  {cell.avgScore}
                                </div>
                                <div className="text-xs opacity-75">
                                  n={cell.controlCount}
                                </div>
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center gap-4 text-xs">
                <span className="font-medium">{t("ces.legend")}:</span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-green-500" /> {">"}=80
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-yellow-400" /> 50-79
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-orange-400" /> 30-49
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-red-500" /> {"<"}30
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ModuleGate>
  );
}
