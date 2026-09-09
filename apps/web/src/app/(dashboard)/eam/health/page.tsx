"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArchHealthScore } from "@grc/shared";
import type { UnvalidatedJson } from "@/lib/unvalidated-json";

export default function ArchitectureHealthPage() {
  return (
    <ModuleGate moduleKey="eam">
      <HealthInner />
    </ModuleGate>
  );
}

function HealthInner() {
  const t = useTranslations("eam");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Beide Anfragen liefen immer
  // zusammen und werden zusammen gelesen, daher eine Abfrage mit einem
  // Ergebnisobjekt. Eine nicht-ok-Antwort liefert wie vorher den
  // Ausgangswert (null bzw. leere Liste).
  const { data, isPending: loading } = useQuery<{
    score: ArchHealthScore | null;
    trend: UnvalidatedJson[];
  }>({
    queryKey: ["eam", "health-score"],
    queryFn: async () => {
      const [scoreRes, trendRes] = await Promise.all([
        fetch("/api/v1/eam/health-score"),
        fetch("/api/v1/eam/health-score/trend"),
      ]);
      const score: ArchHealthScore | null = scoreRes.ok
        ? ((await scoreRes.json()).data as ArchHealthScore)
        : null;
      const trend: UnvalidatedJson[] = trendRes.ok
        ? (((await trendRes.json()).data ?? []) as UnvalidatedJson[])
        : [];
      return { score, trend };
    },
  });
  const score = data?.score ?? null;
  const trend = data?.trend ?? [];

  if (loading || !score) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const scoreColor =
    score.overall >= 80
      ? "text-green-600"
      : score.overall >= 60
        ? "text-yellow-600"
        : "text-red-600";

  const factors = [
    { key: "portfolioAge", value: score.portfolioAge, weight: 20 },
    { key: "techCurrency", value: score.techCurrency, weight: 20 },
    {
      key: "integrationComplexity",
      value: score.integrationComplexity,
      weight: 15,
    },
    { key: "spofScore", value: score.spofScore, weight: 15 },
    { key: "ruleCompliance", value: score.ruleCompliance, weight: 15 },
    { key: "dataFlowCompliance", value: score.dataFlowCompliance, weight: 15 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("health.title")}</h1>
        <Button variant="outline">
          <FileDown className="h-4 w-4 mr-2" />
          Generate Executive Report
        </Button>
      </div>

      {/* Overall Score */}
      <Card className="text-center p-8">
        <p className="text-sm text-muted-foreground">
          {t("health.overallScore")}
        </p>
        <p className={`text-6xl font-bold ${scoreColor}`}>{score.overall}</p>
        <p className="text-muted-foreground">/100</p>
      </Card>

      {/* Factor Breakdown */}
      <div className="grid gap-3">
        {factors.map((f) => (
          <Card key={f.key}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t(`health.${f.key}` as Parameters<typeof t>[0])}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full ${f.value >= 80 ? "bg-green-500" : f.value >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${f.value}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{f.value}</p>
                <p className="text-xs text-muted-foreground">{f.weight}%</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend */}
      {trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">12-Month Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {trend.map((s: UnvalidatedJson, i: number) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/80 rounded-t"
                  style={{ height: `${s.overallScore}%` }}
                  title={`${s.overallScore}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
