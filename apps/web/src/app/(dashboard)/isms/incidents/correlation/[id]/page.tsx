"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Link2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncidentCorrelation } from "@grc/shared";

export default function CorrelationDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <DetailInner />
    </ModuleGate>
  );
}

function DetailInner() {
  const t = useTranslations("correlation");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [correlation, setCorrelation] = useState<IncidentCorrelation | null>(null);

  useEffect(() => {
    const fetchCorrelation = async () => {
      try {
        const res = await fetch(`/api/v1/isms/incidents/correlations?limit=100`);
        if (res.ok) {
          const json = await res.json();
          const found = (json.data ?? []).find(
            (c: IncidentCorrelation) => c.id === params.id,
          );
          setCorrelation(found ?? null);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchCorrelation();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!correlation) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("notFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/isms/incidents/correlation")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {correlation.campaignName ?? t("correlationDetail")}
        </h1>
        <Badge variant="outline">{correlation.correlationType}</Badge>
        <Badge>{correlation.confidence}%</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("reasoning")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{correlation.reasoning}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sharedFactors")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(correlation.sharedFactorsJson ?? []).map((factor, i) => (
              <div key={i} className="mb-2 rounded border p-3 text-sm">
                <p className="font-medium">{(factor as { factor: string }).factor}</p>
                <p className="text-muted-foreground">{(factor as { description: string }).description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Link2 className="mr-2 inline h-5 w-5" />
            {t("correlatedIncidents")} ({correlation.incidentIds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {correlation.incidentIds.map((incId) => (
              <div
                key={incId}
                className="cursor-pointer rounded border p-3 text-sm hover:bg-muted/25"
                onClick={() => router.push(`/isms/incidents/${incId}`)}
              >
                {incId}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
