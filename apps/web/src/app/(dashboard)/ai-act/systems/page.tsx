"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiSystem } from "@grc/shared";

const RISK_COLORS: Record<string, string> = { unacceptable: "bg-red-100 text-red-900", high: "bg-orange-100 text-orange-900", limited: "bg-yellow-100 text-yellow-900", minimal: "bg-green-100 text-green-900" };

export default function AiSystemsPage() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/systems?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("systemInventory")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("addSystem")}</Button>
      </div>
      <div className="space-y-2">
        {rows.map((sys) => (
          <Link key={sys.id} href={`/ai-act/systems/${sys.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer"><CardContent className="p-4 flex items-center justify-between">
              <div><p className="font-medium">{sys.systemCode} - {sys.name}</p><p className="text-sm text-muted-foreground">{sys.aiTechnique} | {sys.providerOrDeployer}</p></div>
              <div className="flex gap-2"><Badge className={RISK_COLORS[sys.riskClassification] ?? ""}>{sys.riskClassification}</Badge><Badge variant="outline">{sys.status}</Badge></div>
            </CardContent></Card>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">{t("noSystems")}</p>}
      </div>
    </div>
  );
}
