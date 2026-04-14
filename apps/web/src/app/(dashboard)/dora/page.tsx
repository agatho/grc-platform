"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Shield, AlertTriangle, Server, Users, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoraDashboard } from "@grc/shared";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

export default function DoraDashboardPage() {
  const t = useTranslations("dora");
  const [data, setData] = useState<DoraDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/dora/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dora/ict-risks"><Button variant="outline"><Shield className="h-4 w-4 mr-2" />{t("ictRisks")}</Button></Link>
          <Link href="/dora/ict-incidents"><Button variant="outline"><AlertTriangle className="h-4 w-4 mr-2" />{t("incidents")}</Button></Link>
          <Link href="/dora/ict-providers"><Button variant="outline"><Server className="h-4 w-4 mr-2" />{t("providers")}</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalIctRisks")}</p><p className="text-2xl font-bold">{data.totalIctRisks}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("criticalRisks")}</p><p className="text-2xl font-bold text-red-600">{data.criticalRisks}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("openIncidents")}</p><p className="text-2xl font-bold text-orange-600">{data.openIncidents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("majorIncidents")}</p><p className="text-2xl font-bold text-red-600">{data.majorIncidents}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalProviders")}</p><p className="text-2xl font-bold">{data.totalProviders}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("criticalProviders")}</p><p className="text-2xl font-bold text-orange-600">{data.criticalProviders}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("pendingReports")}</p><p className="text-2xl font-bold text-yellow-600">{data.pendingReports}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("nis2Compliance")}</p><p className="text-2xl font-bold text-green-600">{data.nis2ComplianceRate}%</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("nav.tlptPlans")}</CardTitle>
            <Link href="/dora/tlpt-plans"><Button variant="outline" size="sm">{t("viewAll")}</Button></Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("noUpcomingTests")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("nav.informationSharing")}</CardTitle>
            <Link href="/dora/information-sharing"><Button variant="outline" size="sm">{t("viewAll")}</Button></Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("noRecentSharing")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
