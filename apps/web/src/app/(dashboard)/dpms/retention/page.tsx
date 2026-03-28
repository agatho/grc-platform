"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Clock, AlertTriangle, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RetentionSchedule } from "@grc/shared";

export default function RetentionDashboardPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <RetentionDashboardInner />
    </ModuleGate>
  );
}

function RetentionDashboardInner() {
  const t = useTranslations("dpms-advanced");
  const [schedules, setSchedules] = useState<RetentionSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dpms/retention-schedules?limit=100")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setSchedules(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("retentionManagement")}</h1>
          <p className="text-muted-foreground">{t("retentionDescription")}</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />{t("addSchedule")}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalSchedules")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{schedules.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("activeSchedules")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{schedules.filter((s) => s.isActive).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("categories")}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{new Set(schedules.map((s) => s.dataCategory)).size}</div></CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {schedules.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {s.legalBasisReference} - {s.retentionPeriodMonths} {t("months")}
                </p>
              </div>
              <Badge variant="outline">{s.dataCategory.replace(/_/g, " ")}</Badge>
              <Badge variant={s.deletionMethod === "automated" ? "default" : "secondary"}>
                {s.deletionMethod}
              </Badge>
              {!s.isActive && <Badge variant="destructive">{t("inactive")}</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
