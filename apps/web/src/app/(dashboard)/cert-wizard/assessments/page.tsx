"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CertReadinessAssessment } from "@grc/shared";

export default function CertAssessmentsPage() {
  const t = useTranslations("certWizard");
  const [rows, setRows] = useState<CertReadinessAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/cert-wizard/assessments?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.assessments")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />New Assessment</Button>
      </div>
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id}><CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{a.assessmentCode} - {a.title}</p>
              <p className="text-sm text-muted-foreground">{a.framework} {a.frameworkVersion ?? ""} | {a.targetCertDate ?? "No target date"}</p>
            </div>
            <div className="flex gap-2 items-center">
              <div className="text-right">
                <p className="text-lg font-bold">{a.readinessScore ? `${Number(a.readinessScore).toFixed(0)}%` : "N/A"}</p>
                <p className="text-xs text-muted-foreground">{a.implementedControls}/{a.totalControls}</p>
              </div>
              <Badge variant="outline">{a.status}</Badge>
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No readiness assessments yet. Start your certification journey.</p>}
      </div>
    </div>
  );
}
