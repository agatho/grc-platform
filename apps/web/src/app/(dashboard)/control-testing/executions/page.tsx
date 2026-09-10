"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TestTube } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ControlTestExecution } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  running: "bg-blue-100 text-blue-900",
  passed: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
  error: "bg-red-100 text-red-900",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ControlTestExecutionsPage() {
  const t = useTranslations("controlTesting");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const { data: executions = [], isPending: loading } = useQuery<
    ControlTestExecution[]
  >({
    queryKey: ["control-testing", "executions"],
    queryFn: async () => {
      const res = await fetch("/api/v1/control-testing/executions?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as ControlTestExecution[];
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("executions.title")}</h1>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {executions.map((exec) => (
              <div key={exec.id} className="p-4 hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TestTube className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {exec.id.substring(0, 8)}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {exec.triggeredBy}{" "}
                        {exec.durationMs ? `- ${exec.durationMs}ms` : ""} -{" "}
                        {exec.findingsGenerated} {t("executions.findings")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exec.result && (
                      <Badge variant="outline">{exec.result}</Badge>
                    )}
                    <Badge className={STATUS_COLORS[exec.status] ?? ""}>
                      {exec.status}
                    </Badge>
                  </div>
                </div>
                {exec.summary && (
                  <p className="text-sm text-muted-foreground mt-2 ml-7">
                    {exec.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
