"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CCMDashboardData } from "@grc/shared";

export default function CCMDashboardPage() {
  return (
    <ModuleGate moduleKey="ics">
      <CCMDashboardInner />
    </ModuleGate>
  );
}

function CCMDashboardInner() {
  const t = useTranslations("icsAdvanced");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CCMDashboardData | null>(null);

  useEffect(() => {
    fetch("/api/v1/ics/ccm/dashboard")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("ccmDashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalMonitored")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data?.totalMonitored ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">{t("passing")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{data?.passCount ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-600">{t("degraded")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-600">{data?.degradedCount ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">{t("failing")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-600">{data?.failCount ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("controlStatus")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.controls?.map((ctrl) => (
              <div key={ctrl.controlId} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium">{ctrl.controlTitle}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={ctrl.latestResult === "pass" ? "default" : ctrl.latestResult === "degraded" ? "secondary" : "destructive"}>
                    {ctrl.latestResult}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{ctrl.latestScore}/100</span>
                </div>
              </div>
            )) ?? <p className="text-muted-foreground">{t("noMonitoredControls")}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
