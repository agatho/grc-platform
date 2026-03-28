"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Brain, AlertTriangle, TrendingUp, Radar, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PredictiveRiskDashboard } from "@grc/shared";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

export default function PredictiveRiskDashboardPage() {
  const t = useTranslations("predictiveRisk");
  const [data, setData] = useState<PredictiveRiskDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/predictive-risk/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/predictive-risk/models"><Button variant="outline"><Brain className="h-4 w-4 mr-2" />{t("models")}</Button></Link>
          <Link href="/predictive-risk/radar"><Button variant="outline"><Radar className="h-4 w-4 mr-2" />{t("radar")}</Button></Link>
          <Link href="/predictive-risk/anomalies"><Button variant="outline"><AlertTriangle className="h-4 w-4 mr-2" />{t("anomalies")}</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("activeModels")}</p><p className="text-2xl font-bold">{data.activeModels}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalPredictions")}</p><p className="text-2xl font-bold">{data.totalPredictions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("earlyWarnings")}</p><p className="text-2xl font-bold text-orange-600">{data.earlyWarnings}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("criticalAnomalies")}</p><p className="text-2xl font-bold text-red-600">{data.criticalAnomalies}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("avgAccuracy")}</p><p className="text-2xl font-bold">{Number(data.avgModelAccuracy).toFixed(1)}%</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("topEarlyWarnings")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topEarlyWarnings.map((pred) => (
                <div key={pred.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">{pred.entityType}: {pred.entityId.substring(0, 8)}</span>
                    </div>
                    <Badge className={SEVERITY_COLORS[pred.riskLevel ?? "medium"] ?? ""}>{pred.riskLevel}</Badge>
                  </div>
                  {pred.earlyWarningMessage && (
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{pred.earlyWarningMessage}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("topAnomalies")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topAnomalies.map((anomaly) => (
                <div key={anomaly.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div>
                        <span className="text-sm font-medium">{anomaly.metricName}</span>
                        <p className="text-xs text-muted-foreground">{anomaly.anomalyType} - {anomaly.entityType}</p>
                      </div>
                    </div>
                    <Badge className={SEVERITY_COLORS[anomaly.severity] ?? ""}>{anomaly.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
