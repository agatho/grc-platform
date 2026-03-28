"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TestTube } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ControlTestExecution } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  running: "bg-blue-100 text-blue-700",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ControlTestExecutionsPage() {
  const t = useTranslations("controlTesting");
  const [executions, setExecutions] = useState<ControlTestExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/control-testing/executions?limit=50");
      if (res.ok) setExecutions((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
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
                      <p className="font-medium text-sm">{exec.id.substring(0, 8)}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {exec.triggeredBy} {exec.durationMs ? `- ${exec.durationMs}ms` : ""} - {exec.findingsGenerated} {t("executions.findings")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exec.result && <Badge variant="outline">{exec.result}</Badge>}
                    <Badge className={STATUS_COLORS[exec.status] ?? ""}>{exec.status}</Badge>
                  </div>
                </div>
                {exec.summary && <p className="text-sm text-muted-foreground mt-2 ml-7">{exec.summary}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
