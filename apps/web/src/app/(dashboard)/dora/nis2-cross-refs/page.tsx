"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DoraNis2CrossRef } from "@grc/shared";

const COMP_COLORS: Record<string, string> = { compliant: "bg-green-100 text-green-900", partially_compliant: "bg-yellow-100 text-yellow-900", non_compliant: "bg-red-100 text-red-900", not_assessed: "bg-gray-100 text-gray-700" };

export default function DoraNis2CrossRefsPage() {
  const t = useTranslations("dora");
  const [rows, setRows] = useState<DoraNis2CrossRef[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/dora/nis2-cross-refs?limit=100"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.nis2CrossRef")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />Add Cross-Reference</Button>
      </div>
      <div className="space-y-2">
        {rows.map((ref) => (
          <Card key={ref.id}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">DORA {ref.doraArticle} {ref.nis2Article ? `/ NIS2 ${ref.nis2Article}` : ""}</p><p className="text-sm text-muted-foreground">{ref.overlapType}</p></div>
            <Badge className={COMP_COLORS[ref.complianceStatus] ?? ""}>{ref.complianceStatus}</Badge>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No cross-references yet</p>}
      </div>
    </div>
  );
}
