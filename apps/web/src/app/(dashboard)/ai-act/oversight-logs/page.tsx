"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiHumanOversightLog } from "@grc/shared";

export default function AiOversightLogsPage() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiHumanOversightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/oversight-logs?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
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
          Log Oversight
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
                  {log.logType} |{" "}
                  {new Date(log.reviewedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">{log.logType}</Badge>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No oversight logs yet
          </p>
        )}
      </div>
    </div>
  );
}
