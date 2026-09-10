"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TestTube, Plus, Sparkles, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ControlTestScript } from "@grc/shared";

export default function ControlTestScriptsPage() {
  const t = useTranslations("controlTesting");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const {
    data: scripts = [],
    isPending: loading,
    refetch,
  } = useQuery<ControlTestScript[]>({
    queryKey: ["control-testing", "scripts"],
    queryFn: async () => {
      const res = await fetch("/api/v1/control-testing/scripts?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as ControlTestScript[];
    },
  });

  const fetchScripts = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const executeScript = async (id: string) => {
    await fetch(`/api/v1/control-testing/scripts/${id}/execute`, {
      method: "POST",
    });
    await fetchScripts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("scripts.title")}</h1>
        <div className="flex gap-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t("scripts.create")}
          </Button>
          <Button variant="outline">
            <Sparkles className="h-4 w-4 mr-2" />
            {t("scripts.aiGenerate")}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {scripts.map((script) => (
          <Card key={script.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TestTube className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{script.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Badge variant="outline">{script.testType}</Badge>
                      {script.aiGenerated && (
                        <Badge variant="secondary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {t("scripts.aiGenerated")}
                        </Badge>
                      )}
                      {script.frequency && <span>{script.frequency}</span>}
                      <span>v{script.version}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={script.isActive ? "default" : "secondary"}>
                    {script.isActive
                      ? t("scripts.active")
                      : t("scripts.inactive")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeScript(script.id)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {t("scripts.run")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
