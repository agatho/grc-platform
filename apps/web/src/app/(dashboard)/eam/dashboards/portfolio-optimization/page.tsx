"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

export default function PortfolioOptimizationPage() {
  const t = useTranslations("eamDashboards");
  const [distributions, setDistributions] = useState<
    Record<string, Array<{ value: string; count: number }>>
  >({});
  const [health, setHealth] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/v1/eam/dashboards/portfolio-optimization")
      .then((r) => r.json())
      .then((r) => setDistributions(r.data));
    fetch("/api/v1/eam/dashboards/portfolio-optimization/health")
      .then((r) => r.json())
      .then((r) => setHealth(r.data));
  }, []);

  const donutLabels: Record<string, string> = {
    license_type: t("portfolio.category"),
    functional_fit: t("portfolio.functionalFit"),
    technical_fit: t("portfolio.technicalFit"),
    lifecycle_status: t("portfolio.lifecycle"),
    business_criticality: t("portfolio.criticality"),
    time_classification: t("portfolio.time"),
    six_r_strategy: t("portfolio.sixR"),
  };

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("portfolio.title")}</h1>

        {/* 6 Donut Grid (3x2) */}
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(donutLabels)
            .slice(0, 6)
            .map(([key, label]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent className="h-48">
                  <div className="space-y-1">
                    {(distributions[key] ?? []).map((entry) => (
                      <div
                        key={entry.value}
                        className="flex justify-between text-sm"
                      >
                        <span>{entry.value}</span>
                        <span className="font-medium">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Portfolio Health Indicators */}
        {health && (
          <div className="grid grid-cols-4 gap-4">
            <Card
              className={
                health.insufficientFunctionalFitPct > 20 ? "border-red-500" : ""
              }
            >
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">
                  {health.insufficientFunctionalFitPct}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.insufficientFit")}
                </p>
              </CardContent>
            </Card>
            <Card
              className={
                health.approachingEolPct > 15 ? "border-yellow-500" : ""
              }
            >
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">
                  {health.approachingEolPct}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.approachingEol")}
                </p>
              </CardContent>
            </Card>
            <Card className={health.unassessedPct > 30 ? "border-red-500" : ""}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{health.unassessedPct}%</p>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.unassessed")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">
                  {health.noSixRDecisionPct}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.noSixR")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ModuleGate>
  );
}
