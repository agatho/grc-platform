"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Activity } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResilienceScore } from "@grc/shared";

export default function ResilienceDashboardPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <ResilienceDashboardInner />
    </ModuleGate>
  );
}

function ResilienceDashboardInner() {
  const t = useTranslations("bcmsAdvanced");
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<ResilienceScore | null>(null);

  useEffect(() => {
    fetch("/api/v1/bcms/resilience/score")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => setScore(json?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const factors = score ? [
    { label: t("biaCompleteness"), value: score.biaCompleteness, weight: 20 },
    { label: t("bcpCurrency"), value: score.bcpCurrency, weight: 15 },
    { label: t("exerciseCompletion"), value: score.exerciseCompletion, weight: 15 },
    { label: t("recoverCapability"), value: score.recoverCapability, weight: 20 },
    { label: t("communicationReadiness"), value: score.communicationReadiness, weight: 10 },
    { label: t("procedureCompleteness"), value: score.procedureCompleteness, weight: 10 },
    { label: t("supplyChainResilience"), value: score.supplyChainResilience, weight: 10 },
  ] : [];

  const scoreColor = (val: number) => {
    if (val >= 80) return "text-green-600";
    if (val >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("resilienceDashboard")}</h1>

      <Card>
        <CardHeader><CardTitle>{t("overallScore")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="text-center">
            <div className={`text-6xl font-bold ${scoreColor(score?.overallScore ?? 0)}`}>
              {score?.overallScore ?? 0}
            </div>
            <p className="text-muted-foreground mt-2">{t("outOf100")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {factors.map((f) => (
          <Card key={f.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{f.label} ({f.weight}%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${scoreColor(f.value)}`}>{f.value}</div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.value >= 80 ? "bg-green-500" : f.value >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${f.value}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
