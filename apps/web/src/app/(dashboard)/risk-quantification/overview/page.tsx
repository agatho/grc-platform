"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Calculator,
  TrendingDown,
  Shield,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RiskQuantificationOverviewPage() {
  const t = useTranslations("riskQuantification");
  const router = useRouter();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [latestVar, setLatestVar] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/risk-quantification/config").then((r) => r.json()),
      fetch("/api/v1/risk-quantification/var-calculations?limit=1").then((r) =>
        r.json(),
      ),
    ])
      .then(([configJson, varJson]) => {
        setConfig(configJson.data);
        setLatestVar(varJson.data?.[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => router.push("/risk-quantification/var-calculations")}
        >
          <Calculator className="mr-2 h-4 w-4" />
          {t("runCalculation")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => router.push("/risk-quantification/var-calculations")}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t("valueAtRisk")}</CardDescription>
            <CardTitle className="text-2xl">
              {latestVar
                ? `${Number(latestVar.varP95 ?? 0).toLocaleString()} EUR`
                : "--"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t("p95Confidence")}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => router.push("/risk-quantification/appetite")}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t("riskAppetite")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("viewThresholds")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => router.push("/risk-quantification/sensitivity")}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t("sensitivityAnalysis")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              {t("tornadoDiagram")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() =>
            router.push("/risk-quantification/executive-summaries")
          }
        >
          <CardHeader className="pb-2">
            <CardDescription>{t("executiveSummary")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("boardReport")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {config && (
        <Card>
          <CardHeader>
            <CardTitle>{t("configuration")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <Badge variant="outline">
              {t("methodology")}: {String(config.methodology ?? "hybrid")}
            </Badge>
            <Badge variant="outline">
              {t("iterations")}: {String(config.defaultIterations ?? 10000)}
            </Badge>
            <Badge variant="outline">
              {t("confidence")}:{" "}
              {String(Number(config.confidenceLevel ?? 0.95) * 100)}%
            </Badge>
            <Badge variant="outline">
              {t("currency")}: {String(config.currencyCode ?? "EUR")}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
