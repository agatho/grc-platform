"use client";

import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export default function EamGovernancePage() {
  const t = useTranslations("eamGovernance");

  return (
    <ModuleGate moduleKey="eam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="grid grid-cols-5 gap-4">
          {["draft", "pending_review", "approved", "published", "archived"].map(
            (status) => (
              <Card key={status}>
                <CardContent className="pt-4 text-center">
                  <Badge variant="outline">{t(`status.${status}`)}</Badge>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      </div>
    </ModuleGate>
  );
}
