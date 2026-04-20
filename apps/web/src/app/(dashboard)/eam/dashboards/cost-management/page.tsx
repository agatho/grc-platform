"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export default function CostManagementDashboardPage() {
  const t = useTranslations("eamDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [treemapApps, setTreemapApps] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    fetch("/api/v1/eam/dashboards/cost-management")
      .then((r) => r.json())
      .then((r) => setData(r.data));
    fetch("/api/v1/eam/dashboards/cost-management/treemap-apps")
      .then((r) => r.json())
      .then((r) => setTreemapApps(r.data));
  }, []);

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("costManagement.title")}</h1>

        {/* KPI Bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("costManagement.totalApps")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {(data as Record<string, number>)?.totalApplications ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("costManagement.totalAppCost")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                }).format(
                  (data as Record<string, number>)?.totalApplicationCost ?? 0,
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("costManagement.totalComponents")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {(data as Record<string, number>)?.totalComponents ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("costManagement.totalComponentCost")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                }).format(
                  (data as Record<string, number>)?.totalComponentCost ?? 0,
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Treemap Section - D3.js treemaps would render here */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("costManagement.appCostByCategory")}</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t("costManagement.treemapPlaceholder")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("costManagement.infraCostByProvider")}</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t("costManagement.treemapPlaceholder")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail Tables */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("costManagement.appCostTable")}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* DataTable with application costs */}
              <div className="text-sm text-muted-foreground">
                {t("costManagement.loadingData")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("costManagement.componentCostTable")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {t("costManagement.loadingData")}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleGate>
  );
}
