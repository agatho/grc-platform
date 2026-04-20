"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileText, Scale, Archive, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxCmsDashboard } from "@grc/shared";

export default function TaxCmsDashboardPage() {
  const t = useTranslations("taxCms");
  const [data, setData] = useState<TaxCmsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/tax-cms/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  if (loading || !data)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tax-cms/elements">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              {t("elements")}
            </Button>
          </Link>
          <Link href="/tax-cms/risks">
            <Button variant="outline">
              <Scale className="h-4 w-4 mr-2" />
              {t("risks")}
            </Button>
          </Link>
          <Link href="/tax-cms/gobd-archives">
            <Button variant="outline">
              <Archive className="h-4 w-4 mr-2" />
              {t("gobdArchive")}
            </Button>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("totalElements")}
            </p>
            <p className="text-2xl font-bold">{data.totalElements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("avgMaturity")}</p>
            <p className="text-2xl font-bold">
              {data.averageMaturity.toFixed(1)}/5
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("totalTaxRisks")}
            </p>
            <p className="text-2xl font-bold">{data.totalTaxRisks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("criticalRisks")}
            </p>
            <p className="text-2xl font-bold text-red-600">
              {data.criticalRisks}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("gobdCompliance")}
            </p>
            <p className="text-2xl font-bold">
              {data.gobdCompliantDocs}/{data.totalArchiveDocs}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("keyControlsEffective")}
            </p>
            <p className="text-2xl font-bold">
              {data.keyControlsEffective}/{data.totalKeyControls}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("activeAudits")}</p>
            <p className="text-2xl font-bold">{data.activeAudits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("totalExposure")}
            </p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: "EUR",
              }).format(data.totalExposure)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
