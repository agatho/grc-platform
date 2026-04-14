"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, AlertTriangle, Globe } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DataFlow } from "@grc/shared";

export default function DataFlowsPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ModuleTabNav />
      <DataFlowsInner />
    </ModuleGate>
  );
}

function DataFlowsInner() {
  const t = useTranslations("eam");
  const [flows, setFlows] = useState<DataFlow[]>([]);
  const [filter, setFilter] = useState<"all" | "personal" | "crossBorder">("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/v1/eam/data-flows?limit=200";
      if (filter === "personal") url += "&personalData=true";
      if (filter === "crossBorder") url += "&crossBorder=true";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setFlows(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const crossBorderCount = flows.filter((f) => f.crossesEuBorder).length;
  const personalCount = flows.filter((f) => f.containsPersonalData).length;
  const missingSafeguard = flows.filter((f) => f.crossesEuBorder && f.schremsIiSafeguard === "none").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dataFlows.title")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("dataFlows.createFlow")}</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{flows.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("dataFlows.personalData")}</p><p className="text-2xl font-bold">{personalCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("dataFlows.crossBorder")}</p><p className="text-2xl font-bold">{crossBorderCount}</p></CardContent></Card>
        <Card className={missingSafeguard > 0 ? "border-red-200" : ""}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Missing Safeguards</p>
            <p className={`text-2xl font-bold ${missingSafeguard > 0 ? "text-red-600" : ""}`}>{missingSafeguard}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
        <Button variant={filter === "personal" ? "default" : "outline"} size="sm" onClick={() => setFilter("personal")}>{t("dataFlows.personalData")}</Button>
        <Button variant={filter === "crossBorder" ? "default" : "outline"} size="sm" onClick={() => setFilter("crossBorder")}>{t("dataFlows.crossBorder")}</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid gap-3">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{flow.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {flow.transferMechanism} | {flow.frequency} | {flow.hostingSource ?? "?"} → {flow.hostingTarget ?? "?"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {flow.containsPersonalData && <Badge variant="destructive">{t("dataFlows.personalData")}</Badge>}
                  {flow.crossesEuBorder && (
                    <Badge variant="outline" className="border-red-300 text-red-700">
                      <Globe className="h-3 w-3 mr-1" />{t("dataFlows.crossBorder")}
                    </Badge>
                  )}
                  {flow.crossesEuBorder && flow.schremsIiSafeguard === "none" && (
                    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />No Safeguard</Badge>
                  )}
                  <Badge variant="outline">{flow.encryptionInTransit}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
