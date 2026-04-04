"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Shield, Users, TrendingDown } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConsentType } from "@grc/shared";

export default function ConsentDashboardPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <ConsentDashboardInner />
    </ModuleGate>
  );
}

function ConsentDashboardInner() {
  const t = useTranslations("dpmsAdvanced");
  const [types, setTypes] = useState<ConsentType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dpms/consent-types?limit=100")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setTypes(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const totalActive = types.reduce((a, t) => a + t.activeConsents, 0);
  const totalWithdrawn = types.reduce((a, t) => a + t.totalWithdrawn, 0);
  const avgRate = types.length > 0 ? types.reduce((a, t) => a + t.withdrawalRate, 0) / types.length : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("consentDashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("activeConsents")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{totalActive}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalWithdrawals")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-600">{totalWithdrawn}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("avgWithdrawalRate")}</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${avgRate > 30 ? "text-red-600" : "text-green-600"}`}>
              {avgRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {types.map((ct) => (
          <Card key={ct.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{ct.name}</p>
                <p className="text-sm text-muted-foreground">{ct.purpose} / {ct.collectionPoint}</p>
              </div>
              <div className="text-right text-sm">
                <div>{t("active")}: <strong>{ct.activeConsents}</strong></div>
                <div className={ct.withdrawalRate > 30 ? "text-red-600" : "text-muted-foreground"}>
                  {t("withdrawalRate")}: {ct.withdrawalRate}%
                </div>
              </div>
              {ct.freelyGivenStatus && (
                <Badge variant={ct.freelyGivenStatus === "valid" ? "default" : ct.freelyGivenStatus === "questionable" ? "secondary" : "destructive"}>
                  Art. 7: {ct.freelyGivenStatus}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
