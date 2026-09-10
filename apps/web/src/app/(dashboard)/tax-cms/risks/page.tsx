"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxRisk } from "@grc/shared";

const LEVEL_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};

export default function TaxRisksPage() {
  const t = useTranslations("taxCms");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`).
  const { data: rows = [], isPending: loading } = useQuery<TaxRisk[]>({
    queryKey: ["tax-cms", "risks"],
    queryFn: async () => {
      const res = await fetch("/api/v1/tax-cms/risks?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as TaxRisk[];
    },
  });
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.risks")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Tax Risk
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((risk) => (
          <Card key={risk.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {risk.riskCode} - {risk.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {risk.taxType} | {risk.jurisdiction}{" "}
                  {risk.hgb91Reference ? "| HGB 91" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className={LEVEL_COLORS[risk.riskLevel] ?? ""}>
                  {risk.riskLevel}
                </Badge>
                <Badge variant="outline">{risk.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No tax risks registered yet
          </p>
        )}
      </div>
    </div>
  );
}
