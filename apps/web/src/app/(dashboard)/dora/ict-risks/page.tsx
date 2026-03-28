"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoraIctRisk } from "@grc/shared";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700", low: "bg-green-100 text-green-700",
};

export default function DoraIctRisksPage() {
  const t = useTranslations("dora");
  const [rows, setRows] = useState<DoraIctRisk[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/dora/ict-risks?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("ictRiskRegister")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("addRisk")}</Button>
      </div>
      <div className="space-y-2">
        {rows.map((risk) => (
          <Card key={risk.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{risk.riskCode} - {risk.title}</p>
                <p className="text-sm text-muted-foreground">{risk.ictAssetType} | {risk.doraArticleRef ?? ""}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={RISK_COLORS[risk.riskLevel] ?? ""}>{risk.riskLevel}</Badge>
                <Badge variant="outline">{risk.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">{t("noRisks")}</p>}
      </div>
    </div>
  );
}
