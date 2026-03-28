"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { TestTube, FileCheck, ListChecks, Brain, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ControlTestingDashboard } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  running: "bg-blue-100 text-blue-700",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
};

export default function ControlTestingDashboardPage() {
  const t = useTranslations("controlTesting");
  const [data, setData] = useState<ControlTestingDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/control-testing/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/control-testing/scripts"><Button variant="outline"><TestTube className="h-4 w-4 mr-2" />{t("scripts")}</Button></Link>
          <Link href="/control-testing/checklists"><Button variant="outline"><ListChecks className="h-4 w-4 mr-2" />{t("checklists")}</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("activeScripts")}</p><p className="text-2xl font-bold">{data.activeScripts}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("passRate")}</p><p className="text-2xl font-bold text-green-600">{data.passRate ?? 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("failRate")}</p><p className="text-2xl font-bold text-red-600">{data.failRate ?? 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("learningPatterns")}</p><p className="text-2xl font-bold">{data.learningPatterns}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("recentExecutions")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentExecutions.map((exec) => (
              <Link key={exec.id} href={`/control-testing/executions?id=${exec.id}`} className="block">
                <div className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <TestTube className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{t("execution")} {exec.id.substring(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{exec.triggeredBy} - {exec.durationMs ? `${exec.durationMs}ms` : t("inProgress")}</p>
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[exec.status] ?? ""}>{exec.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
