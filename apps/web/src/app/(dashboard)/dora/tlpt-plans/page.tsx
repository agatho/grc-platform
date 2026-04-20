"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DoraTlptPlan } from "@grc/shared";

export default function DoraTlptPlansPage() {
  const t = useTranslations("dora");
  const [rows, setRows] = useState<DoraTlptPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/dora/tlpt-plans?limit=50");
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.tlptPlans")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add TLPT Plan
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {plan.planCode} - {plan.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.testType} | {plan.plannedStartDate ?? "TBD"}
                </p>
              </div>
              <Badge variant="outline">{plan.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No TLPT plans yet
          </p>
        )}
      </div>
    </div>
  );
}
