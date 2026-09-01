"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EamCatalogPage() {
  const t = useTranslations("eamCatalog");

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button>{t("action")}</Button>
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
