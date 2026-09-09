"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YoyMetric {
  id: string;
  metricName: string;
  esrsStandard: string;
  unit: string;
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  explanation: string | null;
  direction: "improvement" | "deterioration" | "neutral";
}

async function fetchYoyMetrics(esrsStandard: string): Promise<YoyMetric[]> {
  const params = new URLSearchParams({ includeYoy: "true" });
  if (esrsStandard) params.set("esrsStandard", esrsStandard);
  const res = await fetch(`/api/v1/esg/measurements?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as YoyMetric[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EsgYoyPage() {
  return (
    <ModuleGate moduleKey="esg">
      <EsgYoyInner />
    </ModuleGate>
  );
}

function EsgYoyInner() {
  const [filter, setFilter] = useState("");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Der Filter steht im Schlüssel.
  const { data: metrics = [], isPending: loading } = useQuery<YoyMetric[]>({
    queryKey: ["esg", "yoy", filter],
    queryFn: () => fetchYoyMetrics(filter),
  });

  // Auswahlliste der ESRS-Standards.
  // [Welle 7a · OP-080] Absicht: die Liste wird aus dem UNGEFILTERTEN
  // Ergebnis gefuellt und schrumpft nicht auf den gerade gewaehlten Standard
  // zusammen — sonst kaeme der Nutzer nicht mehr zurueck. Vorher hielt ein
  // eigener Zustand den ersten Bestand fest; jetzt haengt eine zweite
  // Abfrage am Schluessel ohne Filter: bei leerem Filter ist es dieselbe
  // Abfrage (dedupliziert, kein zweiter Request), bei gesetztem Filter bleibt
  // der ungefilterte Bestand im Cache und die Liste steht weiter vollstaendig.
  const { data: allMetrics = [] } = useQuery<YoyMetric[]>({
    queryKey: ["esg", "yoy", ""],
    queryFn: () => fetchYoyMetrics(""),
  });
  const standards = [...new Set(allMetrics.map((m) => m.esrsStandard))].sort();

  if (loading && metrics.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jahresvergleich ESG-Kennzahlen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ver\u00e4nderungen von ESG-Metriken gegen\u00fcber dem Vorjahr
          </p>
        </div>
      </div>

      {/* Filter */}
      {standards.length > 0 && (
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Alle ESRS-Standards</option>
            {standards.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>ESG-Kennzahlen\u00fcbersicht</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Keine ESG-Messwerte mit Vorjahresdaten verf\u00fcgbar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Metrik
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      ESRS
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Aktueller Wert
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Vorjahreswert
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Ver\u00e4nderung (%)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Erkl\u00e4rung
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {metrics.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.metricName}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {m.esrsStandard}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {m.currentValue != null
                          ? `${m.currentValue} ${m.unit}`
                          : "--"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {m.previousValue != null
                          ? `${m.previousValue} ${m.unit}`
                          : "--"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChangeCell
                          changePercent={m.changePercent}
                          direction={m.direction}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {m.explanation ?? "--"}
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
  );
}

function ChangeCell({
  changePercent,
  direction,
}: {
  changePercent: number | null;
  direction: string;
}) {
  if (changePercent == null) {
    return <span className="text-gray-400">--</span>;
  }

  const isImprovement = direction === "improvement";
  const isDeterioration = direction === "deterioration";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${
        isImprovement
          ? "text-green-700"
          : isDeterioration
            ? "text-red-700"
            : "text-gray-600"
      }`}
    >
      {isImprovement ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : isDeterioration ? (
        <TrendingDown className="h-3.5 w-3.5" />
      ) : (
        <Minus className="h-3.5 w-3.5" />
      )}
      {changePercent > 0 ? "+" : ""}
      {changePercent.toFixed(1)}%
    </span>
  );
}
