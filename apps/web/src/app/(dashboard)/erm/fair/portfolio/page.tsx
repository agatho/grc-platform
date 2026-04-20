"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TopRisk {
  riskId: string;
  riskTitle: string;
  riskCategory: string;
  status: string;
  ownerName?: string;
  aleP50: number;
  aleP95: number;
  aleMean: number;
  computedAt: string;
}

interface AggregateData {
  totalAleP50: number;
  totalAleP95: number;
  totalAleMean: number;
  riskCount: number;
  byCategory: Array<{
    category: string;
    aleP50: number;
    aleP95: number;
    count: number;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  strategic: "#8b5cf6",
  operational: "#3b82f6",
  financial: "#10b981",
  compliance: "#f59e0b",
  cyber: "#ef4444",
  reputational: "#ec4899",
  esg: "#06b6d4",
};

export default function FAIRPortfolioPage() {
  return (
    <ModuleGate moduleKey="erm">
      <FAIRPortfolioInner />
    </ModuleGate>
  );
}

function FAIRPortfolioInner() {
  const t = useTranslations("fair");

  const [loading, setLoading] = useState(true);
  const [topRisks, setTopRisks] = useState<TopRisk[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [topRes, aggRes] = await Promise.all([
        fetch("/api/v1/erm/fair/top-risks?limit=50"),
        fetch("/api/v1/erm/fair/aggregate"),
      ]);

      if (topRes.ok) {
        const data = await topRes.json();
        setTopRisks(data.data ?? []);
      }
      if (aggRes.ok) {
        const data = await aggRes.json();
        setAggregate(data.data ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Scatter data: x=frequency proxy (aleP50/lm est), y=magnitude proxy (aleP95-aleP50), size=aleP50
  const scatterData = topRisks.map((r) => ({
    x: r.aleMean > 0 ? r.aleP50 / r.aleMean : 1,
    y: r.aleP95 - r.aleP50,
    z: r.aleP50,
    name: r.riskTitle,
    category: r.riskCategory,
    color: CATEGORY_COLORS[r.riskCategory] ?? "#6b7280",
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("portfolioTitle")}</h1>
        <p className="text-muted-foreground">{t("portfolioSubtitle")}</p>
      </div>

      {/* Aggregate KPIs */}
      {aggregate && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-blue-500">
            <p className="text-sm text-muted-foreground">{t("totalALE")}</p>
            <p className="text-2xl font-bold">
              {formatEUR(aggregate.totalAleP50)}
            </p>
            <p className="text-xs text-muted-foreground">
              P50 {t("aggregate")}
            </p>
          </Card>
          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-sm text-muted-foreground">{t("totalVaR")}</p>
            <p className="text-2xl font-bold text-red-700">
              {formatEUR(aggregate.totalAleP95)}
            </p>
            <p className="text-xs text-muted-foreground">
              P95 {t("aggregate")}
            </p>
          </Card>
          <Card className="p-4 border-l-4 border-l-green-500">
            <p className="text-sm text-muted-foreground">
              {t("quantifiedRisks")}
            </p>
            <p className="text-2xl font-bold">{aggregate.riskCount}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-purple-500">
            <p className="text-sm text-muted-foreground">{t("avgALE")}</p>
            <p className="text-2xl font-bold">
              {aggregate.riskCount > 0
                ? formatEUR(aggregate.totalAleP50 / aggregate.riskCount)
                : "-"}
            </p>
          </Card>
        </div>
      )}

      {/* Portfolio Scatter */}
      {topRisks.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t("riskScatter")}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("riskScatterDesc")}
          </p>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={t("relativeFrequency")}
                  label={{
                    value: t("relativeFrequency"),
                    position: "bottom",
                    offset: -5,
                  }}
                  fontSize={11}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={t("tailRisk")}
                  tickFormatter={formatCompactEUR}
                  label={{
                    value: t("tailRisk"),
                    angle: -90,
                    position: "insideLeft",
                  }}
                  fontSize={11}
                />
                <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                <RechartsTooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border rounded-lg p-3 shadow-lg text-sm">
                        <p className="font-semibold">{d.name}</p>
                        <p>
                          {t("category")}: {d.category}
                        </p>
                        <p>ALE P50: {formatEUR(d.z)}</p>
                        <p>
                          {t("tailRisk")}: {formatEUR(d.y)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {aggregate && aggregate.byCategory.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t("categoryBreakdown")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{t("category")}</th>
                  <th className="text-right p-2">{t("riskCount")}</th>
                  <th className="text-right p-2">ALE P50</th>
                  <th className="text-right p-2">ALE P95</th>
                  <th className="text-right p-2">{t("percentOfTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.byCategory.map((cat) => (
                  <tr key={cat.category} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[cat.category] ?? "#6b7280",
                          }}
                        />
                        <Badge variant="outline">{cat.category}</Badge>
                      </div>
                    </td>
                    <td className="p-2 text-right">{cat.count}</td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(cat.aleP50)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(cat.aleP95)}
                    </td>
                    <td className="p-2 text-right">
                      {aggregate.totalAleP50 > 0
                        ? `${((cat.aleP50 / aggregate.totalAleP50) * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top Risks Ranking */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t("topRisksRanking")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">{t("riskName")}</th>
                <th className="text-left p-2">{t("category")}</th>
                <th className="text-right p-2">ALE P50</th>
                <th className="text-right p-2">ALE P95</th>
                <th className="text-left p-2">{t("owner")}</th>
              </tr>
            </thead>
            <tbody>
              {topRisks.slice(0, 10).map((r, idx) => (
                <tr key={r.riskId} className="border-b last:border-0">
                  <td className="p-2 font-medium">{idx + 1}</td>
                  <td className="p-2 font-medium">{r.riskTitle}</td>
                  <td className="p-2">
                    <Badge variant="outline">{r.riskCategory}</Badge>
                  </td>
                  <td className="p-2 text-right font-mono">
                    {formatEUR(r.aleP50)}
                  </td>
                  <td className="p-2 text-right font-mono text-red-600">
                    {formatEUR(r.aleP95)}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {r.ownerName ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
