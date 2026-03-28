"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  Link2,
  TrendingUp,
  Shield,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IncidentCorrelation, DetectedPattern } from "@grc/shared";

export default function CorrelationPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CorrelationInner />
    </ModuleGate>
  );
}

function CorrelationInner() {
  const t = useTranslations("correlation");
  const router = useRouter();
  const [correlations, setCorrelations] = useState<IncidentCorrelation[]>([]);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [windowDays, setWindowDays] = useState("90");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [corrRes, patternRes] = await Promise.all([
        fetch("/api/v1/isms/incidents/correlations?limit=100"),
        fetch(`/api/v1/isms/incidents/patterns?windowDays=${windowDays}`),
      ]);
      if (corrRes.ok) {
        const json = await corrRes.json();
        setCorrelations(json.data ?? []);
      }
      if (patternRes.ok) {
        const json = await patternRes.json();
        setPatterns(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const runCorrelation = useCallback(async () => {
    setComputing(true);
    try {
      const res = await fetch("/api/v1/isms/incidents/correlate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowDays: Number(windowDays) }),
      });
      if (res.ok) {
        void fetchData();
      }
    } finally {
      setComputing(false);
    }
  }, [windowDays, fetchData]);

  const confidenceColor = (confidence: number) => {
    if (confidence >= 80) return "destructive";
    if (confidence >= 50) return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 {t("days")}</SelectItem>
              <SelectItem value="30">30 {t("days")}</SelectItem>
              <SelectItem value="90">90 {t("days")}</SelectItem>
              <SelectItem value="365">1 {t("year")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runCorrelation} disabled={computing}>
            {computing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {t("runAnalysis")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Correlation List */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link2 className="mr-2 inline h-5 w-5" />
                  {t("detectedCorrelations")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {correlations.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8">{t("noCorrelations")}</p>
                ) : (
                  <div className="space-y-3">
                    {correlations.map((corr) => (
                      <div
                        key={corr.id}
                        className="cursor-pointer rounded border p-4 hover:bg-muted/25"
                        onClick={() => router.push(`/isms/incidents/correlation/${corr.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{corr.correlationType}</Badge>
                            {corr.campaignName && (
                              <span className="font-medium">{corr.campaignName}</span>
                            )}
                          </div>
                          <Badge variant={confidenceColor(corr.confidence)}>
                            {corr.confidence}%
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{corr.reasoning}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {corr.incidentIds.length} {t("incidents")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pattern Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <TrendingUp className="mr-2 inline h-5 w-5" />
                  {t("detectedPatterns")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {patterns.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">{t("noPatterns")}</p>
                ) : (
                  <div className="space-y-3">
                    {patterns.map((pattern, i) => (
                      <div key={i} className="rounded border p-3">
                        <p className="text-sm font-medium">{pattern.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            variant={
                              pattern.confidence === "high"
                                ? "destructive"
                                : pattern.confidence === "medium"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {pattern.confidence}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {pattern.occurrences} {t("occurrences")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
