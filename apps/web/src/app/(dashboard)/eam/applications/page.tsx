"use client";

import { useCallback, useEffect, useState } from "react";
import { useDateFormat } from "@/lib/format-date";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { UnvalidatedJson } from "@/lib/unvalidated-json";

const LIFECYCLE_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-900",
  active: "bg-green-100 text-green-900",
  phase_out: "bg-yellow-100 text-yellow-900",
  end_of_life: "bg-red-100 text-red-900",
  retired: "bg-gray-100 text-gray-500",
};

const TIME_COLORS: Record<string, string> = {
  tolerate: "bg-blue-100 text-blue-900",
  invest: "bg-green-100 text-green-900",
  migrate: "bg-yellow-100 text-yellow-900",
  eliminate: "bg-red-100 text-red-900",
};

export default function ApplicationsPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ModuleTabNav />
      <ApplicationsInner />
    </ModuleGate>
  );
}

function ApplicationsInner() {
  // [ARCTOS-FULL-2026-08-31 · OP-070] Betraege standen fest im deutschen
  // Zahlenformat, obwohl die Seite uebersetzt ist.
  const { locale: numberLocale } = useDateFormat();
  const t = useTranslations("eam");
  const [apps, setApps] = useState<UnvalidatedJson[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "quadrant" | "timeline">("list");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // [ARCTOS-FULL-2026-08-31 · OP-050] `limit=200` steht hier bewusst
      // stehen und ist trotzdem ein Befund: `GET /api/v1/eam/applications`
      // benutzt `paginate()` NICHT, sondern klemmt selbst
      // (`Math.min(parseInt(limit ?? "100"), 500)`) und kennt kein `page`.
      // Diese Aufrufstelle läuft heute also — sie bricht in dem Moment, in dem
      // die Route auf den Vertrag umgestellt wird. Der Wächter in
      // `src/__tests__/lib/client-pagination-contract.test.ts` prüft genau
      // diese Paarung und wird rot, sobald die Route `paginate()` benutzt.
      // Die Umstellung der Route gehört Strang 1a (siehe UMSETZUNG-WELLE-1B.md).
      const res = await fetch("/api/v1/eam/applications?limit=200");
      if (res.ok) {
        const json = await res.json();
        setApps(json.data ?? []);
      } else {
        console.error(
          "eam/applications: Anwendungsliste nicht geladen",
          res.status,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("portfolio.title")}</h1>
        <div className="flex gap-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            {t("portfolio.listView")}
          </Button>
          <Button
            variant={view === "quadrant" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("quadrant")}
          >
            {t("portfolio.quadrantView")}
          </Button>
          <Button
            variant={view === "timeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("timeline")}
          >
            {t("portfolio.timelineView")}
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t("portfolio.registerApp")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {apps.map((app) => (
          <Link
            key={app.element?.id ?? app.id}
            href={`/eam/applications/${app.element?.id ?? app.id}`}
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{app.element?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {app.portfolio?.vendorName ?? "-"} | v
                    {app.portfolio?.version ?? "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {app.portfolio?.licenseType && (
                    <Badge variant="outline">{app.portfolio.licenseType}</Badge>
                  )}
                  {app.portfolio?.lifecycleStatus && (
                    <Badge
                      className={
                        LIFECYCLE_COLORS[app.portfolio.lifecycleStatus] ?? ""
                      }
                    >
                      {app.portfolio.lifecycleStatus}
                    </Badge>
                  )}
                  {app.portfolio?.timeClassification && (
                    <Badge
                      className={
                        TIME_COLORS[app.portfolio.timeClassification] ?? ""
                      }
                    >
                      {t(
                        `portfolio.${app.portfolio.timeClassification}` as Parameters<
                          typeof t
                        >[0],
                      )}
                    </Badge>
                  )}
                  {app.portfolio?.annualCost && (
                    <span className="text-sm font-medium">
                      {Number(app.portfolio.annualCost).toLocaleString(
                        numberLocale,
                        { style: "currency", currency: "EUR" },
                      )}
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
