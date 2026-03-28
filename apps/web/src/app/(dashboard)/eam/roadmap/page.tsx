"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@grc/ui/card";
import { useEffect, useState } from "react";

export default function EamVisualizationPage() {
  const t = useTranslations("eamDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t("visualization")}</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t("visualizationPlaceholder")}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
