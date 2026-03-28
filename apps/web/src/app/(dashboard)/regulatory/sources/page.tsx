"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegulatorySource } from "@grc/shared";

export default function RegulatorySourcesPage() {
  const t = useTranslations("regulatory");
  const [sources, setSources] = useState<RegulatorySource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/regulatory-changes/sources");
      if (res.ok) setSources((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchSources(); }, [fetchSources]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("sources.title")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("sources.add")}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((src) => (
          <Card key={src.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />{src.name}</CardTitle>
                <Badge variant={src.isActive ? "default" : "secondary"}>{src.isActive ? t("sources.active") : t("sources.inactive")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t("sources.type")}: {src.sourceType}</p>
                <p>{t("sources.jurisdiction")}: {src.jurisdiction}</p>
                <p>{t("sources.frequency")}: {src.fetchFrequencyHours}h</p>
                <p>{t("sources.detected")}: {src.totalChangesDetected}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
