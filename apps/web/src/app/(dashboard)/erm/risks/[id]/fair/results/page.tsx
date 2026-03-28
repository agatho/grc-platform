"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ArrowLeft,
  RefreshCcw,
  Download,
  TrendingUp,
  Shield,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SimResult {
  id: string;
  status: string;
  aleP5?: string;
  aleP25?: string;
  aleP50?: string;
  aleP75?: string;
  aleP95?: string;
  aleMean?: string;
  aleStdDev?: string;
  histogram?: Array<{ bucket: number; bucketMax: number; count: number; percentage: number }>;
  lossExceedance?: Array<{ threshold: number; probability: number }>;
  sensitivity?: Array<{ parameter: string; impact: number; label: string }>;
  computedAt?: string;
  iterations: number;
}

export default function FAIRResultsPage() {
  return (
    <ModuleGate moduleKey="erm">
      <FAIRResultsInner />
    </ModuleGate>
  );
}

function FAIRResultsInner() {
  const t = useTranslations("fair");
  const params = useParams();
  const router = useRouter();
  const riskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SimResult | null>(null);
  const [allResults, setAllResults] = useState<SimResult[]>([]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/erm/risks/${riskId}/fair/results`);
      if (res.ok) {
        const data = await res.json();
        setResult(data.data?.latest ?? null);
        setAllResults(data.data?.results ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [riskId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("noResults")}</h2>
          <p className="text-muted-foreground mb-4">{t("noResultsDesc")}</p>
          <Button onClick={() => router.push(`/erm/risks/${riskId}/fair`)}>
            {t("configureParams")}
          </Button>
        </Card>
      </div>
    );
  }

  const aleP50 = Number(result.aleP50) || 0;
  const aleP95 = Number(result.aleP95) || 0;
  const aleMean = Number(result.aleMean) || 0;
  const aleP5 = Number(result.aleP5) || 0;
  const aleP25 = Number(result.aleP25) || 0;
  const aleP75 = Number(result.aleP75) || 0;
  const aleStdDev = Number(result.aleStdDev) || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/erm/risks/${riskId}/fair`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("backToParams")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("resultsTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {result.iterations.toLocaleString()} {t("iterationsLabel")} &middot;{" "}
              {result.computedAt
                ? new Date(result.computedAt).toLocaleString("de-DE")
                : "-"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchResults}>
            <RefreshCcw className="h-4 w-4 mr-1" />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-muted-foreground">{t("expectedALE")}</p>
          <p className="text-2xl font-bold text-green-700">{formatEUR(aleP50)}</p>
          <p className="text-xs text-muted-foreground">{t("median")} (P50)</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-muted-foreground">VaR (95%)</p>
          <p className="text-2xl font-bold text-red-700">{formatEUR(aleP95)}</p>
          <p className="text-xs text-muted-foreground">{t("worstRealistic")}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-muted-foreground">{t("aleMean")}</p>
          <p className="text-2xl font-bold">{formatEUR(aleMean)}</p>
          <p className="text-xs text-muted-foreground">{t("arithmeticMean")}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500">
          <p className="text-sm text-muted-foreground">{t("aleStdDev")}</p>
          <p className="text-2xl font-bold text-muted-foreground">{formatEUR(aleStdDev)}</p>
          <p className="text-xs text-muted-foreground">{t("volatility")}</p>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="histogram">
        <TabsList>
          <TabsTrigger value="histogram">{t("histogram")}</TabsTrigger>
          <TabsTrigger value="exceedance">{t("exceedanceCurve")}</TabsTrigger>
          <TabsTrigger value="tornado">{t("tornado")}</TabsTrigger>
          <TabsTrigger value="percentiles">{t("percentiles")}</TabsTrigger>
        </TabsList>

        {/* Histogram */}
        <TabsContent value="histogram">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("lossDistribution")}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.histogram ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(val) => formatCompactEUR(val)}
                    fontSize={11}
                  />
                  <YAxis fontSize={11} />
                  <RechartsTooltip
                    formatter={(value: unknown) => [
                      String(value),
                      t("frequency"),
                    ]}
                    labelFormatter={(label) => formatEUR(label)}
                  />
                  <ReferenceLine
                    x={result.histogram?.reduce(
                      (closest, b) =>
                        Math.abs(b.bucket - aleP50) <
                        Math.abs(closest.bucket - aleP50)
                          ? b
                          : closest,
                      result.histogram[0],
                    )?.bucket}
                    stroke="#16a34a"
                    strokeDasharray="5 5"
                    label={{ value: "P50", position: "top", fill: "#16a34a" }}
                  />
                  <ReferenceLine
                    x={result.histogram?.reduce(
                      (closest, b) =>
                        Math.abs(b.bucket - aleP95) <
                        Math.abs(closest.bucket - aleP95)
                          ? b
                          : closest,
                      result.histogram[0],
                    )?.bucket}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    label={{ value: "P95", position: "top", fill: "#dc2626" }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {(result.histogram ?? []).map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.bucket >= aleP95
                            ? "#fca5a5"
                            : entry.bucket >= aleP50
                              ? "#fde68a"
                              : "#86efac"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Loss Exceedance Curve */}
        <TabsContent value="exceedance">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("exceedanceTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("exceedanceDesc")}</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.lossExceedance ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="threshold"
                    tickFormatter={(val) => formatCompactEUR(val)}
                    fontSize={11}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    fontSize={11}
                  />
                  <RechartsTooltip
                    formatter={(value: unknown) => [
                      `${(Number(value) * 100).toFixed(1)}%`,
                      t("probability"),
                    ]}
                    labelFormatter={(label) => `${t("lossExceeds")} ${formatEUR(label)}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="probability"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ReferenceLine
                    y={0.05}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    label={{ value: "5%", position: "right", fill: "#dc2626" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Tornado Diagram */}
        <TabsContent value="tornado">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("sensitivityAnalysis")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("sensitivityDesc")}</p>
            <div className="space-y-4">
              {(result.sensitivity ?? []).map((s) => (
                <div key={s.parameter} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground">
                      {(s.impact * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${s.impact * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Percentile Table */}
        <TabsContent value="percentiles">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("percentileTable")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">{t("percentile")}</th>
                    <th className="text-right p-2 font-medium">{t("aleValue")}</th>
                    <th className="text-left p-2 font-medium">{t("interpretation")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { p: "P5", val: aleP5, desc: t("p5Desc") },
                    { p: "P25", val: aleP25, desc: t("p25Desc") },
                    { p: "P50", val: aleP50, desc: t("p50Desc") },
                    { p: "P75", val: aleP75, desc: t("p75Desc") },
                    { p: "P95", val: aleP95, desc: t("p95Desc") },
                  ].map((row) => (
                    <tr key={row.p} className="border-b last:border-0">
                      <td className="p-2 font-medium">{row.p}</td>
                      <td className="p-2 text-right font-mono">{formatEUR(row.val)}</td>
                      <td className="p-2 text-muted-foreground">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Simulation History */}
      {allResults.length > 1 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t("simulationHistory")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{t("date")}</th>
                  <th className="text-right p-2">{t("iterations")}</th>
                  <th className="text-right p-2">ALE P50</th>
                  <th className="text-right p-2">ALE P95</th>
                  <th className="text-left p-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">
                      {r.computedAt
                        ? new Date(r.computedAt).toLocaleString("de-DE")
                        : "-"}
                    </td>
                    <td className="p-2 text-right">{r.iterations.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">
                      {r.aleP50 ? formatEUR(Number(r.aleP50)) : "-"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {r.aleP95 ? formatEUR(Number(r.aleP95)) : "-"}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant={
                          r.status === "completed"
                            ? "default"
                            : r.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactEUR(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}
