"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@grc/ui/card";
import { DataTable } from "@/components/data-table";
import { Button } from "@grc/ui/button";
import { useEffect, useState } from "react";

export default function EamDataArchitecturePage() {
  const t = useTranslations("eamDataArchitecture");
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button>{t("create")}</Button>
        </div>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
