"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { GripVertical, Plus, Save, Loader2, Settings2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export default function BiReportDesignerPage() {
  const t = useTranslations("biReporting");
  const searchParams = useSearchParams();
  const reportId = searchParams.get("id");
  const [name, setName] = useState("");
  const [moduleScope, setModuleScope] = useState("all");
  const [widgets, setWidgets] = useState<Array<{ id: string; type: string; title: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reportId) {
      fetch(`/api/v1/bi-reports/${reportId}`).then((r) => r.json()).then((json) => {
        if (json.data) {
          setName(json.data.name);
          setModuleScope(json.data.moduleScope);
        }
      });
      fetch(`/api/v1/bi-reports/widgets?reportId=${reportId}`).then((r) => r.json()).then((json) => {
        setWidgets((json.data ?? []).map((w: Record<string, string>) => ({
          id: w.id, type: w.widgetType, title: w.title ?? "",
        })));
      });
    }
  }, [reportId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (reportId) {
        await fetch(`/api/v1/bi-reports/${reportId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, moduleScope }),
        });
      } else {
        await fetch("/api/v1/bi-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, moduleScope }),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const widgetTypes = [
    "kpi_card", "bar_chart", "line_chart", "donut_chart", "heatmap",
    "table", "text_block", "radar_chart", "gauge", "treemap",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {reportId ? t("editReport") : t("createReport")}
          </h1>
          <p className="text-muted-foreground">{t("designerDescription")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            {t("preview")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("reportSettings")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("reportName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("reportNamePlaceholder")} />
              </div>
              <div>
                <Label>{t("moduleScope")}</Label>
                <Select value={moduleScope} onValueChange={setModuleScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "erm", "isms", "audit", "bcms", "esg", "ics", "dpms", "tprm", "bpm"].map((s) => (
                      <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("canvas")}</CardTitle>
            </CardHeader>
            <CardContent>
              {widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <GripVertical className="h-8 w-8 mb-2" />
                  <p>{t("dragWidgets")}</p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-2">
                  {widgets.map((w) => (
                    <Card key={w.id} className="border-dashed">
                      <CardContent className="p-4">
                        <p className="font-medium">{w.title || w.type}</p>
                        <p className="text-sm text-muted-foreground">{w.type}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("widgetPalette")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {widgetTypes.map((wt) => (
                <Button
                  key={wt}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setWidgets((prev) => [...prev, { id: crypto.randomUUID(), type: wt, title: "" }])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {wt.replace(/_/g, " ")}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
