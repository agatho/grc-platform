"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  FileWarning,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditAnalyticsResult, BenfordResult } from "@grc/shared";

export default function AnalysisResultsPage() {
  return (
    <ModuleGate moduleKey="audit">
      <ResultsInner />
    </ModuleGate>
  );
}

function ResultsInner() {
  const t = useTranslations("analytics");
  const router = useRouter();
  const params = useParams<{ importId: string }>();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<AuditAnalyticsResult[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(
          `/api/v1/audit-mgmt/analytics/imports/${params.importId}/results`,
        );
        if (res.ok) {
          const json = await res.json();
          setResults(json.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchResults();
  }, [params.importId]);

  const createFinding = async (resultId: string) => {
    const res = await fetch(
      `/api/v1/audit-mgmt/analytics/results/${resultId}/create-finding`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (res.ok) {
      // Refresh results to show linked finding
      const updatedRes = await fetch(
        `/api/v1/audit-mgmt/analytics/imports/${params.importId}/results`,
      );
      if (updatedRes.ok) {
        const json = await updatedRes.json();
        setResults(json.data ?? []);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/audit/analytics")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{t("analysisResults")}</h1>
      </div>

      {results.length === 0 ? (
        <p className="text-center text-muted-foreground p-8">
          {t("noResults")}
        </p>
      ) : (
        <div className="space-y-6">
          {results.map((result) => {
            const summary = result.summaryJson as {
              flaggedCount: number;
              totalAnalyzed: number;
              significance: boolean;
            };

            return (
              <Card key={result.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">{result.analysisType}</Badge>
                      {summary.significance ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {t("anomalyDetected")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          {t("noAnomaly")}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2">
                      {!result.findingId && summary.flaggedCount > 0 && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => createFinding(result.id)}
                        >
                          <FileWarning className="mr-1 h-3 w-3" />
                          {t("createFinding")}
                        </Button>
                      )}
                      {result.findingId && (
                        <Badge variant="outline">{t("findingLinked")}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {summary.totalAnalyzed}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("analyzed")}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {summary.flaggedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("flagged")}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {summary.totalAnalyzed > 0
                          ? (
                              (summary.flaggedCount / summary.totalAnalyzed) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("flagRate")}
                      </p>
                    </div>
                  </div>

                  {/* Benford specific visualization placeholder */}
                  {result.analysisType === "benford" && (
                    <div className="rounded border bg-muted/10 p-4">
                      <p className="text-sm font-medium mb-2">
                        {t("benfordDistribution")}
                      </p>
                      <div className="flex items-end gap-1 h-32">
                        {(
                          (result.resultJson as unknown as BenfordResult)
                            ?.observed ?? []
                        ).map((d, i) => (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <div className="w-full flex gap-0.5">
                              <div
                                className="flex-1 bg-blue-500 rounded-t"
                                style={{ height: `${d.observed * 400}px` }}
                              />
                              <div
                                className="flex-1 bg-gray-300 rounded-t"
                                style={{ height: `${d.expected * 400}px` }}
                              />
                            </div>
                            <span className="text-xs">{d.digit}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 rounded bg-blue-500" />
                          {t("observed")}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 rounded bg-gray-300" />
                          {t("expected")}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-muted-foreground">
                    {t("analyzedAt")}:{" "}
                    {new Date(result.createdAt).toLocaleString("de-DE")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
