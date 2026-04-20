"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ControlDeficiency } from "@grc/shared";

export default function DeficienciesPage() {
  return (
    <ModuleGate moduleKey="ics">
      <DeficienciesInner />
    </ModuleGate>
  );
}

function DeficienciesInner() {
  const t = useTranslations("icsAdvanced");
  const [items, setItems] = useState<ControlDeficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/ics/deficiencies?limit=100")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setItems(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const classificationColor = (c: string) => {
    if (c === "material_weakness") return "destructive";
    if (c === "significant_deficiency") return "secondary";
    return "outline";
  };

  const statusColumns = [
    "open",
    "in_progress",
    "remediated",
    "retesting",
    "closed",
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("deficiencyManagement")}</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("addDeficiency")}
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4">
        {statusColumns.map((status) => {
          const columnItems = items.filter(
            (i) => i.remediationStatus === status,
          );
          return (
            <div key={status} className="space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {t(`status.${status}`)} ({columnItems.length})
              </h3>
              {columnItems.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3 space-y-2">
                    <p className="font-medium text-sm">{item.title}</p>
                    <Badge variant={classificationColor(item.classification)}>
                      {item.classification.replace(/_/g, " ")}
                    </Badge>
                    {item.remediationDeadline && (
                      <p className="text-xs text-muted-foreground">
                        {t("deadline")}: {item.remediationDeadline}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
