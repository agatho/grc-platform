"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ControlTestChecklist } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function ControlTestChecklistsPage() {
  const t = useTranslations("controlTesting");
  const [checklists, setChecklists] = useState<ControlTestChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/control-testing/checklists?limit=50");
      if (res.ok) setChecklists((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("checklists.title")}</h1>
        <div className="flex gap-2">
          <Button><Plus className="h-4 w-4 mr-2" />{t("checklists.create")}</Button>
          <Button variant="outline"><Sparkles className="h-4 w-4 mr-2" />{t("checklists.aiGenerate")}</Button>
        </div>
      </div>
      <div className="space-y-3">
        {checklists.map((cl) => (
          <Card key={cl.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{cl.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{cl.completedItems}/{cl.totalItems} {t("checklists.items")}</span>
                      {cl.aiGenerated && <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
                      {cl.dueDate && <span>{t("checklists.due")}: {new Date(cl.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[cl.status] ?? ""}>{cl.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
