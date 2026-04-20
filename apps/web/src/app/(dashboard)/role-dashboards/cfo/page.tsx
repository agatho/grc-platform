"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Euro, FileSearch, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CfoDashboardPage() {
  const t = useTranslations("roleDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/role-dashboards/data/cfo")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!data) return null;

  const financial = data.financialExposure as
    | Record<string, number>
    | undefined;
  const audit = data.auditEffort as Record<string, number> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("cfoDashboard")}</h1>
        <p className="text-muted-foreground">{t("cfoDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("expectedLossP50")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Euro className="h-5 w-5" />
              {Number(financial?.total_expected_loss_p50 ?? 0).toLocaleString(
                "de-DE",
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("varP95")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Euro className="h-5 w-5" />
              {Number(financial?.total_var_p95 ?? 0).toLocaleString("de-DE")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("openFindings")}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              {audit?.open_findings ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t("criticalFindings")}: {audit?.critical_findings ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
