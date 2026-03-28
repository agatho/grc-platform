"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Radar, Calendar, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HorizonScannerDashboard } from "@grc/shared";

export default function HorizonScannerDashboardPage() {
  const t = useTranslations("horizonScanner");
  const [data, setData] = useState<HorizonScannerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/horizon-scanner/dashboard"); if (res.ok) setData((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading || !data) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{t("title")}</h1><p className="text-muted-foreground">{t("description")}</p></div>
        <div className="flex gap-2">
          <Link href="/horizon-scanner/sources"><Button variant="outline"><Radar className="h-4 w-4 mr-2" />{t("sources")}</Button></Link>
          <Link href="/horizon-scanner/items"><Button variant="outline"><FileSearch className="h-4 w-4 mr-2" />{t("items")}</Button></Link>
          <Link href="/horizon-scanner/calendar"><Button variant="outline"><Calendar className="h-4 w-4 mr-2" />{t("calendar")}</Button></Link>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("activeSources")}</p><p className="text-2xl font-bold">{data.activeSources}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalItems")}</p><p className="text-2xl font-bold">{data.totalItems}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("newItems")}</p><p className="text-2xl font-bold text-blue-600">{data.newItems}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("criticalItems")}</p><p className="text-2xl font-bold text-red-600">{data.criticalItems}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("pendingAssessments")}</p><p className="text-2xl font-bold text-orange-600">{data.pendingAssessments}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalSources")}</p><p className="text-2xl font-bold">{data.totalSources}</p></CardContent></Card>
      </div>
    </div>
  );
}
