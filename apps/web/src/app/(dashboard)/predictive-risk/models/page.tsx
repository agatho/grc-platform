"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Brain, Plus, Play, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskPredictionModel } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  untrained: "bg-gray-100 text-gray-700",
  training: "bg-blue-100 text-blue-900",
  active: "bg-green-100 text-green-900",
  degraded: "bg-orange-100 text-orange-900",
  archived: "bg-gray-100 text-gray-500",
};

export default function PredictionModelsPage() {
  const t = useTranslations("predictiveRisk");
  const [models, setModels] = useState<RiskPredictionModel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/predictive-risk/models");
      if (res.ok) setModels((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  const trainModel = async (id: string) => {
    await fetch(`/api/v1/predictive-risk/models/${id}/train`, {
      method: "POST",
    });
    await fetchModels();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("models.title")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("models.create")}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  {model.name}
                </CardTitle>
                <Badge className={STATUS_COLORS[model.status] ?? ""}>
                  {model.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {t("models.type")}: {model.modelType}
                </p>
                <p>
                  {t("models.algorithm")}: {model.algorithm}
                </p>
                <p>
                  {t("models.target")}: {model.targetMetric}
                </p>
                {model.accuracy && (
                  <p>
                    {t("models.accuracy")}: {Number(model.accuracy).toFixed(1)}%
                  </p>
                )}
                <p>
                  {t("models.samples")}: {model.trainingSamples}
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trainModel(model.id)}
                  disabled={model.status === "training"}
                >
                  <Play className="h-3 w-3 mr-1" />
                  {t("models.train")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
