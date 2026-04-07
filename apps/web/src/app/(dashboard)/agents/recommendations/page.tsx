"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentRecommendation } from "@grc/shared";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-900",
  warning: "bg-yellow-100 text-yellow-900",
  critical: "bg-red-100 text-red-900",
};

export default function RecommendationsPage() {
  const t = useTranslations("agents");
  const [recs, setRecs] = useState<AgentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/agents/recommendations?status=pending&limit=100");
      if (res.ok) {
        const json = await res.json();
        setRecs(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAction = async (id: string, status: "accepted" | "dismissed") => {
    await fetch(`/api/v1/agents/recommendations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("recommendations.title")}</h1>

      <div className="grid gap-4">
        {recs.map((rec) => (
          <Card key={rec.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[rec.severity] ?? ""}>
                    {t(`recommendations.severity.${rec.severity}` as any)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{rec.entityType}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(rec.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="font-medium">{rec.title}</p>
              <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAction(rec.id, "accepted")}>
                  <Check className="h-3 w-3 mr-1" />
                  {t("recommendations.accept")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAction(rec.id, "dismissed")}>
                  <X className="h-3 w-3 mr-1" />
                  {t("recommendations.dismiss")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {recs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("recommendations.title")} - {t("recommendations.pending")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
