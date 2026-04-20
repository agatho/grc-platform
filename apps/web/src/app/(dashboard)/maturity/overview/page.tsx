"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Target, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MaturityModelRecord {
  id: string;
  moduleKey: string;
  currentLevel: string;
  targetLevel: string | null;
  targetDate: string | null;
  lastCalculatedAt: string | null;
}

const levelColors: Record<string, string> = {
  initial: "destructive",
  managed: "secondary",
  defined: "default",
  quantitatively_managed: "default",
  optimizing: "default",
};

export default function MaturityOverviewPage() {
  const t = useTranslations("benchmarking");
  const router = useRouter();
  const [models, setModels] = useState<MaturityModelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/maturity/models?limit=50");
      const json = await res.json();
      setModels(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("maturityOverview")}</h1>
          <p className="text-muted-foreground">{t("maturityDescription")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/maturity/scorecard")}
          >
            <Target className="mr-2 h-4 w-4" />
            {t("viewScorecard")}
          </Button>
          <Button onClick={() => router.push("/maturity/assessments")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newAssessment")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Card
              key={model.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() =>
                router.push(
                  `/maturity/assessments?moduleKey=${model.moduleKey}`,
                )
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {model.moduleKey.toUpperCase()}
                  </CardTitle>
                  <Badge
                    variant={
                      levelColors[model.currentLevel] as
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline"
                    }
                  >
                    {model.currentLevel.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {model.targetLevel && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("target")}:
                    </span>
                    <Badge variant="outline">
                      {model.targetLevel.replace(/_/g, " ")}
                    </Badge>
                  </div>
                )}
                {model.lastCalculatedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("lastCalculated")}:{" "}
                    {new Date(model.lastCalculatedAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
