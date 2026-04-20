"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Shield, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BoardDashboardPage() {
  const t = useTranslations("roleDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/role-dashboards/data/board?simplified=true")
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

  const compliance = data.compliancePosture as
    | Record<string, number>
    | undefined;
  const maturity = data.maturityRadar as Array<Record<string, string>>;
  const topRisks = data.topRisks as Array<Record<string, string>>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("boardDashboard")}</h1>
        <p className="text-muted-foreground">{t("boardDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("compliancePosture")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {compliance?.compliance_pct ?? 0}%
            </div>
            <p className="text-sm text-muted-foreground">
              {compliance?.compliant ?? 0} / {compliance?.total_controls ?? 0}{" "}
              {t("controlsCompliant")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("maturityRadar")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {maturity?.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {m.module_key?.toUpperCase()}
                  </span>
                  <Badge variant="outline">
                    {m.current_level?.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("topFiveRisks")}</CardTitle>
          <CardDescription>{t("topFiveRisksDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topRisks?.map((risk, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{risk.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {risk.description?.substring(0, 100)}
                  </p>
                </div>
                <Badge
                  variant={
                    risk.risk_level === "critical" ? "destructive" : "secondary"
                  }
                >
                  {risk.risk_level}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
