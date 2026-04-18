"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Radar, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RadarDataPoint } from "@grc/shared";

const RISK_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-50",
  high: "border-orange-500 bg-orange-50",
  medium: "border-yellow-500 bg-yellow-50",
  low: "border-green-500 bg-green-50",
};

const TREND_ICONS: Record<string, typeof TrendingUp> = {
  increasing: TrendingUp,
  stable: Minus,
  decreasing: TrendingDown,
};

export default function PredictiveRadarPage() {
  const t = useTranslations("predictiveRisk");
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/predictive-risk/radar?horizonDays=30");
      if (res.ok) setRadarData((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("radar.title")}</h1>
        <p className="text-muted-foreground">{t("radar.description")}</p>
      </div>

      {radarData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Radar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t("radar.noData")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {radarData.map((point, idx) => {
            const TrendIcon = point.trendDirection ? TREND_ICONS[point.trendDirection] ?? Minus : Minus;
            return (
              <Card key={idx} className={`border-l-4 ${point.riskLevel ? RISK_COLORS[point.riskLevel] ?? "" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{point.entityType}</Badge>
                    <TrendIcon className={`h-4 w-4 ${point.trendDirection === "increasing" ? "text-red-500" : point.trendDirection === "decreasing" ? "text-green-500" : "text-gray-500"}`} />
                  </div>
                  <p className="font-medium text-sm">{point.entityName ?? (point.entityId ? point.entityId.substring(0, 8) : "-")}</p>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t("radar.current")}: </span>
                      <span className="font-medium">{Number(point.currentValue).toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("radar.predicted")}: </span>
                      <span className="font-bold">{Number(point.predictedValue).toFixed(1)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
