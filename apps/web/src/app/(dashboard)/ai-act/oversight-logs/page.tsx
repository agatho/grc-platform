"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiHumanOversightLog } from "@grc/shared";
import { useDateFormat } from "@/lib/format-date";

export default function AiOversightLogsPage() {
  const t = useTranslations("aiAct");
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const { data: rows = [], isPending: loading } = useQuery<
    AiHumanOversightLog[]
  >({
    queryKey: ["ai-act", "oversight-logs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai-act/oversight-logs?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as AiHumanOversightLog[];
    },
  });
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.oversightLogs")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("oversightList.create")}
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {log.description.substring(0, 100)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {log.logType} | {formatDate(log.reviewedAt)}
                </p>
              </div>
              <Badge variant="outline">{log.logType}</Badge>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("oversightList.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
