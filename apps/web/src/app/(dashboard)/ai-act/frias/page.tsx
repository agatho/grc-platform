"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiFria } from "@grc/shared";

const IMPACT_COLORS: Record<string, string> = { high: "bg-red-100 text-red-900", medium: "bg-orange-100 text-orange-900", low: "bg-yellow-100 text-yellow-900", negligible: "bg-green-100 text-green-900" };

export default function AiFriasPage() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiFria[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/frias?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.frias")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />New FRIA</Button>
      </div>
      <div className="space-y-2">
        {rows.map((fria) => (
          <Card key={fria.id}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">{fria.assessmentCode}</p><p className="text-sm text-muted-foreground">{fria.nextReviewDate ? `Next review: ${fria.nextReviewDate}` : ""}</p></div>
            <div className="flex gap-2"><Badge className={IMPACT_COLORS[fria.overallImpact] ?? ""}>{fria.overallImpact}</Badge><Badge variant="outline">{fria.status}</Badge></div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No Fundamental Rights Impact Assessments yet</p>}
      </div>
    </div>
  );
}
