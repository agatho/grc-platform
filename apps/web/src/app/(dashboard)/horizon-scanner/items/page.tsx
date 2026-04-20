"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { HorizonScanItem } from "@grc/shared";

const CLASS_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-blue-100 text-blue-900",
  informational: "bg-gray-100 text-gray-700",
};

export default function HorizonScanItemsPage() {
  const t = useTranslations("horizonScanner");
  const [rows, setRows] = useState<HorizonScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/horizon-scanner/items?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.items")}</h1>
      <div className="space-y-2">
        {rows.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium truncate flex-1">{item.title}</p>
                <div className="flex gap-2 ml-4">
                  <Badge className={CLASS_COLORS[item.classification] ?? ""}>
                    {item.classification}
                  </Badge>
                  <Badge variant="outline">{item.itemType}</Badge>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {item.jurisdiction} | {item.regulatoryBody ?? ""} |{" "}
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString()
                  : ""}
              </p>
              {item.aiSummary && (
                <p className="text-sm mt-2">
                  {item.aiSummary.substring(0, 200)}...
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No regulatory items found
          </p>
        )}
      </div>
    </div>
  );
}
