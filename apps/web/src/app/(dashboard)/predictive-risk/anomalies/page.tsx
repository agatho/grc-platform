"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskAnomalyDetection } from "@grc/shared";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-blue-100 text-blue-900",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-900",
  investigating: "bg-yellow-100 text-yellow-900",
  resolved: "bg-green-100 text-green-900",
  false_positive: "bg-gray-100 text-gray-500",
};

export default function AnomaliesPage() {
  const t = useTranslations("predictiveRisk");
  const [anomalies, setAnomalies] = useState<RiskAnomalyDetection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/predictive-risk/anomalies?limit=50");
      if (res.ok) setAnomalies((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/v1/predictive-risk/anomalies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("anomalies.title")}</h1>
      <div className="space-y-3">
        {anomalies.map((anomaly) => (
          <Card key={anomaly.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{anomaly.metricName}</p>
                    <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{anomaly.entityType}</span>
                      <span>{anomaly.anomalyType}</span>
                      {anomaly.deviationPercent && <span>{Number(anomaly.deviationPercent).toFixed(1)}% {t("anomalies.deviation")}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[anomaly.severity] ?? ""}>{anomaly.severity}</Badge>
                  <Badge className={STATUS_COLORS[anomaly.status] ?? ""}>{anomaly.status}</Badge>
                  {anomaly.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(anomaly.id, "investigating")}>
                      <Eye className="h-3 w-3 mr-1" />{t("anomalies.investigate")}
                    </Button>
                  )}
                  {anomaly.status === "investigating" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(anomaly.id, "resolved")}>
                      <Check className="h-3 w-3 mr-1" />{t("anomalies.resolve")}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
