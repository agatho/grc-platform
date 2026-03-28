"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, TrendingUp, TrendingDown, Minus, Radar } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmergingRisk } from "@grc/shared";

export default function EmergingRisksPage() {
  return (
    <ModuleGate moduleKey="erm">
      <EmergingRisksInner />
    </ModuleGate>
  );
}

function EmergingRisksInner() {
  const t = useTranslations("erm-advanced");
  const [risks, setRisks] = useState<EmergingRisk[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/erm/emerging-risks?limit=50");
      if (res.ok) {
        const json = await res.json();
        setRisks(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trendIcon = (trend: string) => {
    if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend === "decreasing") return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const statusColor = (status: string) => {
    if (status === "monitoring") return "outline";
    if (status === "escalating") return "secondary";
    if (status === "materializing") return "destructive";
    return "default";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("emergingRisks")}</h1>
          <p className="text-muted-foreground">{t("emergingRisksDescription")}</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />{t("addEmergingRisk")}</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {risks.map((risk) => (
            <Card key={risk.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant={statusColor(risk.status)}>{risk.status}</Badge>
                  {trendIcon(risk.probabilityTrend)}
                </div>
                <CardTitle className="text-base">{risk.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>{t("category")}: {risk.category}</div>
                  <div>{t("timeHorizon")}: {risk.timeHorizon}</div>
                  <div>{t("potentialImpact")}: <Badge variant="outline">{risk.potentialImpact}</Badge></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
