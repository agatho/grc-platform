"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileText, Scale, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxCmsDashboard } from "@grc/shared";
import { useDateFormat } from "@/lib/format-date";

export default function TaxCmsDashboardPage() {
  const t = useTranslations("taxCms");
  const { formatCurrency: money } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`).
  const { data = null, isPending: loading } = useQuery<TaxCmsDashboard | null>({
    queryKey: ["tax-cms", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/tax-cms/dashboard");
      if (!res.ok) return null;
      return ((await res.json()).data ?? null) as TaxCmsDashboard | null;
    },
  });
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
              {money(data.totalExposure, "EUR")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
