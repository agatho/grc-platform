"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CertMockAudit } from "@grc/shared";

export default function CertMockAuditsPage() {
  const t = useTranslations("certWizard");
  const [rows, setRows] = useState<CertMockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/cert-wizard/mock-audits?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.mockAudits")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />New Mock Audit</Button>
      </div>
      <div className="space-y-2">
        {rows.map((audit) => (
          <Card key={audit.id}><CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{audit.auditCode} - {audit.title}</p>
              <p className="text-sm text-muted-foreground">{audit.framework} | {audit.auditType} | {audit.answeredQuestions}/{audit.totalQuestions} answered</p>
            </div>
            <div className="flex gap-2 items-center">
              {audit.overallScore != null && <p className="text-lg font-bold">{Number(audit.overallScore).toFixed(0)}%</p>}
              <Badge variant="outline">{audit.status}</Badge>
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No mock audits yet. Start preparing for your certification audit.</p>}
      </div>
    </div>
  );
}
