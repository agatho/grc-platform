"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle, Package, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CertWizardDashboard } from "@grc/shared";

export default function CertWizardDashboardPage() {
  const t = useTranslations("certWizard");
  const [data, setData] = useState<CertWizardDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/cert-wizard/dashboard"); if (res.ok) setData((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading || !data) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{t("title")}</h1><p className="text-muted-foreground">{t("description")}</p></div>
        <div className="flex gap-2">
          <Link href="/cert-wizard/assessments"><Button variant="outline"><CheckCircle className="h-4 w-4 mr-2" />{t("assessments")}</Button></Link>
          <Link href="/cert-wizard/evidence-packages"><Button variant="outline"><Package className="h-4 w-4 mr-2" />{t("evidencePackages")}</Button></Link>
          <Link href="/cert-wizard/mock-audits"><Button variant="outline"><ClipboardList className="h-4 w-4 mr-2" />{t("mockAudits")}</Button></Link>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalAssessments")}</p><p className="text-2xl font-bold">{data.totalAssessments}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("avgReadiness")}</p><p className="text-2xl font-bold">{data.averageReadiness.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("evidencePackages")}</p><p className="text-2xl font-bold">{data.totalEvidencePackages}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("completedMockAudits")}</p><p className="text-2xl font-bold">{data.completedMockAudits}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("avgMockScore")}</p><p className="text-2xl font-bold">{data.averageMockScore.toFixed(1)}%</p></CardContent></Card>
      </div>
    </div>
  );
}
