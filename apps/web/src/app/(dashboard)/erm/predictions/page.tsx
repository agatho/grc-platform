"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  RefreshCcw,
  Info,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AuditRiskPrediction, PredictionFactor, AuditRiskPredictionModel } from "@grc/shared";

export default function PredictionsPage() {
  return (
    <ModuleGate moduleKey="erm">
      <PredictionsInner />
    </ModuleGate>
  );
}

function PredictionsInner() {
  const t = useTranslations("predictions");
  const [predictions, setPredictions] = useState<AuditRiskPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<AuditRiskPrediction | null>(null);
  const [modelInfo, setModelInfo] = useState<AuditRiskPredictionModel | null>(null);
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [predRes, modelRes] = await Promise.all([
          fetch("/api/v1/erm/predictions?limit=100"),
          fetch("/api/v1/erm/predictions/model-info"),
        ]);
        if (predRes.ok) {
          const json = await predRes.json();
          setPredictions(json.data ?? []);
        }
        if (modelRes.ok) {
          const json = await modelRes.json();
          setModelInfo(json.data);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const retrain = useCallback(async () => {
    setRetraining(true);
    try {
      await fetch("/api/v1/erm/predictions/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algorithm: "linear_regression" }),
      });
    } finally {
      setRetraining(false);
    }
  }, []);

  const probabilityColor = (prob: number) => {
    if (prob >= 70) return "destructive";
    if (prob >= 40) return "default";
    return "secondary";
  };

  const trendIcon = (trend: number) => {
    if (trend > 0.1) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < -0.1) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <Brain className="mr-2 inline h-6 w-6" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="outline" onClick={retrain} disabled={retraining}>
          {retraining ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          {t("retrainModel")}
        </Button>
      </div>

      {/* Escalation Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>{t("escalationRanking")}</CardTitle>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">{t("noPredictions")}</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("risk")}</th>
                    <th className="p-3 text-right">{t("probability")}</th>
                    <th className="p-3 text-left">{t("topFactor")}</th>
                    <th className="p-3 text-center">{t("trend")}</th>
                    <th className="p-3 text-right">{t("confidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((pred) => {
                    const prob = Number(pred.escalationProbability);
                    const factors = pred.topFactorsJson as PredictionFactor[];
                    const features = pred.featuresJson as unknown as Record<string, number>;

                    return (
                      <tr
                        key={pred.id}
                        className="cursor-pointer border-b hover:bg-muted/25"
                        onClick={() => setSelectedPrediction(pred)}
                      >
                        <td className="p-3 font-medium">{pred.riskId.slice(0, 8)}...</td>
                        <td className="p-3 text-right">
                          <Badge variant={probabilityColor(prob)}>
                            {prob.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {factors[0]?.description ?? factors[0]?.factor ?? "-"}
                        </td>
                        <td className="p-3 text-center">
                          {trendIcon(features?.scoreTrend ?? 0)}
                        </td>
                        <td className="p-3 text-right">
                          {pred.confidence ? `${Number(pred.confidence).toFixed(0)}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Info Footer */}
      {modelInfo && (
        <Card>
          <CardContent className="flex items-center gap-6 py-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>{t("modelVersion")}: {modelInfo.version}</span>
            <span>{t("algorithm")}: {modelInfo.algorithm}</span>
            {modelInfo.trainingMetrics && (
              <span>
                R2: {(modelInfo.trainingMetrics as { r2: number }).r2?.toFixed(2) ?? "-"}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Explainability Sheet */}
      <Sheet open={!!selectedPrediction} onOpenChange={() => setSelectedPrediction(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("whyEscalation")}</SheetTitle>
          </SheetHeader>
          {selectedPrediction && (
            <div className="mt-4 space-y-4">
              <Badge variant={probabilityColor(Number(selectedPrediction.escalationProbability))}>
                {Number(selectedPrediction.escalationProbability).toFixed(1)}% {t("escalationProbability")}
              </Badge>

              <div className="space-y-3">
                <h4 className="font-medium">{t("topFactors")}</h4>
                {(selectedPrediction.topFactorsJson as PredictionFactor[]).map((factor, i) => (
                  <div key={i} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{factor.description ?? factor.factor}</span>
                      <Badge variant="outline">{(factor.weight * 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="mt-2 h-2 rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${Math.min(100, factor.weight * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
