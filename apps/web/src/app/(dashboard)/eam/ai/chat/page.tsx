"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function EamAiPage() {
  const t = useTranslations("eamAi");
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/v1/eam/ai/config/status").then((r) => r.json()).then((r) => setStatus(r.data));
  }, []);

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {!status?.configured && (
          <Card className="border-yellow-500">
            <CardContent className="pt-4">
              <p className="text-sm">{t("configureProvider")}</p>
              <Button className="mt-2" variant="outline">{t("setupAi")}</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{t("providerConfig")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
