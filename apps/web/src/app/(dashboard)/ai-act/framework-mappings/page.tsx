"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiFrameworkMappingEntry } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = { implemented: "bg-green-100 text-green-700", in_progress: "bg-yellow-100 text-yellow-700", not_started: "bg-gray-100 text-gray-700", not_applicable: "bg-blue-100 text-blue-700" };

export default function AiFrameworkMappingsPage() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiFrameworkMappingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/framework-mappings?limit=100"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.frameworkMappings")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />Add Mapping</Button>
      </div>
      <div className="space-y-2">
        {rows.map((m) => (
          <Card key={m.id}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">{m.controlRef} - {m.controlTitle}</p><p className="text-sm text-muted-foreground">{m.framework} {m.aiActArticle ? `| AI Act ${m.aiActArticle}` : ""}</p></div>
            <Badge className={STATUS_COLORS[m.implementationStatus] ?? ""}>{m.implementationStatus}</Badge>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No framework mappings yet. Map ISO 42001 / NIST AI RMF controls.</p>}
      </div>
    </div>
  );
}
