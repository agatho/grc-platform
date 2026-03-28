"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegulatoryChange } from "@grc/shared";

const CLASSIFICATION_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  major: "bg-orange-100 text-orange-700",
  minor: "bg-yellow-100 text-yellow-700",
  informational: "bg-blue-100 text-blue-700",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  assessed: "bg-green-100 text-green-700",
  acknowledged: "bg-gray-100 text-gray-700",
  not_applicable: "bg-gray-100 text-gray-500",
};

export default function RegulatoryChangesPage() {
  const t = useTranslations("regulatory");
  const [changes, setChanges] = useState<RegulatoryChange[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/regulatory-changes/changes?limit=50");
      if (res.ok) setChanges((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchChanges(); }, [fetchChanges]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("changes.title")}</h1>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {changes.map((change) => (
              <div key={change.id} className="p-4 hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{change.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{change.summary.substring(0, 200)}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{change.jurisdiction}</span>
                      <span>{change.changeType}</span>
                      {change.effectiveDate && <span>{t("changes.effective")}: {change.effectiveDate}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4">
                    <Badge className={CLASSIFICATION_COLORS[change.classification] ?? ""}>{change.classification}</Badge>
                    <Badge className={STATUS_COLORS[change.status] ?? ""} variant="outline">{change.status}</Badge>
                    {change.relevanceScore && <span className="text-xs">{Number(change.relevanceScore).toFixed(0)}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
