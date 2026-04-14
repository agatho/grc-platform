"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Layers, AppWindow, AlertTriangle, ShieldAlert, Plus, Upload, FileSpreadsheet } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EamDashboardData {
  totalElements: number;
  byLayer: { business: number; application: number; technology: number };
  approachingEol: number;
  spofCount: number;
  violations: number;
}

export default function EamDashboardPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ModuleTabNav />
      <EamDashboardInner />
    </ModuleGate>
  );
}

function EamDashboardInner() {
  const t = useTranslations("eam");
  const [data, setData] = useState<EamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [elemRes, eolRes, spofRes, violRes] = await Promise.all([
        fetch("/api/v1/eam/elements?limit=500"),
        fetch("/api/v1/eam/applications/approaching-eol?months=6"),
        fetch("/api/v1/eam/spof"),
        fetch("/api/v1/eam/violations?status=open"),
      ]);

      const elements = elemRes.ok ? (await elemRes.json()).data : [];
      const eolApps = eolRes.ok ? (await eolRes.json()).data : [];
      const spofs = spofRes.ok ? (await spofRes.json()).data : [];
      const violations = violRes.ok ? (await violRes.json()).data : [];

      setData({
        totalElements: elements.length,
        byLayer: {
          business: elements.filter((e: any) => e.layer === "business").length,
          application: elements.filter((e: any) => e.layer === "application").length,
          technology: elements.filter((e: any) => e.layer === "technology").length,
        },
        approachingEol: eolApps.length,
        spofCount: spofs.length,
        violations: violations.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex gap-2">
          <Link href="/eam/applications"><Button><Plus className="h-4 w-4 mr-2" />{t("portfolio.registerApp")}</Button></Link>
          <Link href="/eam/import"><Button variant="outline"><Upload className="h-4 w-4 mr-2" />{t("import.archimateImport")}</Button></Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("elements")}</p>
            <p className="text-2xl font-bold">{data.totalElements}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("layers.business")}: {data.byLayer.business} | {t("layers.application")}: {data.byLayer.application} | {t("layers.technology")}: {data.byLayer.technology}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("portfolio.approachingEol")}</p>
            <p className={`text-2xl font-bold ${data.approachingEol > 0 ? "text-red-600" : ""}`}>{data.approachingEol}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("spof.title")}</p>
            <p className={`text-2xl font-bold ${data.spofCount > 0 ? "text-red-600" : ""}`}>{data.spofCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("rules.violations")}</p>
            <p className={`text-2xl font-bold ${data.violations > 0 ? "text-amber-600" : ""}`}>{data.violations}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/eam/diagram">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <Layers className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{t("diagram.title")}</p>
                <p className="text-sm text-muted-foreground">{t("layers.business")} + {t("layers.application")} + {t("layers.technology")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/eam/capabilities">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <AppWindow className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{t("capabilities.title")}</p>
                <p className="text-sm text-muted-foreground">{t("capabilities.strategicImportance")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/eam/applications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{t("portfolio.title")}</p>
                <p className="text-sm text-muted-foreground">{t("portfolio.timeClassification")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
