"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxCmsElement } from "@grc/shared";

const MATURITY_COLORS = ["bg-gray-100 text-gray-700", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-yellow-100 text-yellow-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];

export default function TaxCmsElementsPage() {
  const t = useTranslations("taxCms");
  const [rows, setRows] = useState<TaxCmsElement[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/tax-cms/elements?limit=20"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.elements")}</h1>
      <div className="space-y-2">
        {rows.map((el) => (
          <Card key={el.id}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">{el.elementNumber}. {el.name}</p><p className="text-sm text-muted-foreground">{el.elementType}</p></div>
            <div className="flex gap-2">
              <Badge className={MATURITY_COLORS[el.maturityLevel] ?? ""}>{el.maturityLevel}/5</Badge>
              <Badge variant="outline">{el.status}</Badge>
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No IDW PS 980 elements configured yet</p>}
      </div>
    </div>
  );
}
