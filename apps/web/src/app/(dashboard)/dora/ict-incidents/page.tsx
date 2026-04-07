"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DoraIctIncident } from "@grc/shared";

const CLASS_COLORS: Record<string, string> = { major: "bg-red-100 text-red-900", significant: "bg-orange-100 text-orange-900", minor: "bg-yellow-100 text-yellow-900" };

export default function DoraIctIncidentsPage() {
  const t = useTranslations("dora");
  const [rows, setRows] = useState<DoraIctIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/dora/ict-incidents?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("incidentRegister")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("reportIncident")}</Button>
      </div>
      <div className="space-y-2">
        {rows.map((inc) => (
          <Card key={inc.id}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">{inc.incidentCode} - {inc.title}</p><p className="text-sm text-muted-foreground">{inc.incidentType} | {t("detected")}: {new Date(inc.detectedAt).toLocaleDateString()}</p></div>
            <div className="flex gap-2"><Badge className={CLASS_COLORS[inc.classification] ?? ""}>{inc.classification}</Badge><Badge variant="outline">{inc.status}</Badge></div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">{t("noIncidents")}</p>}
      </div>
    </div>
  );
}
