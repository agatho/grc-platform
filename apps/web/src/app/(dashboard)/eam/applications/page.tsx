"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ApplicationWithPortfolio } from "@grc/shared";

const LIFECYCLE_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  phase_out: "bg-yellow-100 text-yellow-700",
  end_of_life: "bg-red-100 text-red-700",
  retired: "bg-gray-100 text-gray-500",
};

const TIME_COLORS: Record<string, string> = {
  tolerate: "bg-blue-100 text-blue-700",
  invest: "bg-green-100 text-green-700",
  migrate: "bg-yellow-100 text-yellow-700",
  eliminate: "bg-red-100 text-red-700",
};

export default function ApplicationsPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ApplicationsInner />
    </ModuleGate>
  );
}

function ApplicationsInner() {
  const t = useTranslations("eam");
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "quadrant" | "timeline">("list");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/eam/applications?limit=200");
      if (res.ok) {
        const json = await res.json();
        setApps(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("portfolio.title")}</h1>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>{t("portfolio.listView")}</Button>
          <Button variant={view === "quadrant" ? "default" : "outline"} size="sm" onClick={() => setView("quadrant")}>{t("portfolio.quadrantView")}</Button>
          <Button variant={view === "timeline" ? "default" : "outline"} size="sm" onClick={() => setView("timeline")}>{t("portfolio.timelineView")}</Button>
          <Button><Plus className="h-4 w-4 mr-2" />{t("portfolio.registerApp")}</Button>
        </div>
      </div>

      <div className="grid gap-3">
        {apps.map((app) => (
          <Link key={app.element?.id ?? app.id} href={`/eam/applications/${app.element?.id ?? app.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{app.element?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {app.portfolio?.vendorName ?? "-"} | v{app.portfolio?.version ?? "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {app.portfolio?.licenseType && (
                    <Badge variant="outline">{app.portfolio.licenseType}</Badge>
                  )}
                  {app.portfolio?.lifecycleStatus && (
                    <Badge className={LIFECYCLE_COLORS[app.portfolio.lifecycleStatus] ?? ""}>
                      {app.portfolio.lifecycleStatus}
                    </Badge>
                  )}
                  {app.portfolio?.timeClassification && (
                    <Badge className={TIME_COLORS[app.portfolio.timeClassification] ?? ""}>
                      {t(`portfolio.${app.portfolio.timeClassification}` as any)}
                    </Badge>
                  )}
                  {app.portfolio?.annualCost && (
                    <span className="text-sm font-medium">
                      {Number(app.portfolio.annualCost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
