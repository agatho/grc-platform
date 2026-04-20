"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CisoDashboardData {
  riskPosture: Record<string, number>;
  topRisks: Array<Record<string, unknown>>;
  controlEffectiveness: Record<string, number>;
  generatedAt: string;
}

export default function CisoDashboardPage() {
  const t = useTranslations("roleDashboards");
  const [data, setData] = useState<CisoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/role-dashboards/data/ciso?topN=10")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("cisoDashboard")}</h1>
        <p className="text-muted-foreground">{t("cisoDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalRisks")}</CardDescription>
            <CardTitle className="text-3xl">
              {data.riskPosture.total_risks ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("criticalRisks")}</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {data.riskPosture.critical_risks ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("effectiveControls")}</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {data.controlEffectiveness.effective_controls ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("ineffectiveControls")}</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {data.controlEffectiveness.ineffective_controls ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("topRisks")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.topRisks as Array<Record<string, string>>).map(
              (risk, idx) => (
                <div
                  key={risk.id ?? idx}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-medium">{risk.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {risk.status}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      risk.risk_level === "critical"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {risk.risk_level}
                  </Badge>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
