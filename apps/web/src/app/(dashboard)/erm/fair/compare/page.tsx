"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompareRisk {
  riskId: string;
  riskTitle: string;
  riskCategory: string;
  riskStatus: string;
  aleP5: number;
  aleP25: number;
  aleP50: number;
  aleP75: number;
  aleP95: number;
  aleMean: number;
  aleStdDev: number;
  iterations: number;
  computedAt: string;
}

export default function FAIRComparePage() {
  return (
    <ModuleGate moduleKey="erm">
      <FAIRCompareInner />
    </ModuleGate>
  );
}

function FAIRCompareInner() {
  const t = useTranslations("fair");
  const searchParams = useSearchParams();
  const riskIds = searchParams.get("riskIds") ?? "";

  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<CompareRisk[]>([]);

  const fetchData = useCallback(async () => {
    if (!riskIds) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/erm/fair/compare?riskIds=${riskIds}`);
      if (res.ok) {
        const data = await res.json();
        setRisks(data.data ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [riskIds]);

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

  if (risks.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("compareEmpty")}</h2>
          <p className="text-muted-foreground">{t("compareEmptyDesc")}</p>
        </Card>
      </div>
    );
  }

  // Prepare box-plot-style data for bar chart
  const chartData = risks.map((r) => ({
    name:
      r.riskTitle.length > 30
        ? r.riskTitle.substring(0, 30) + "..."
        : r.riskTitle,
    P5: r.aleP5,
    P25: r.aleP25,
    P50: r.aleP50,
    P75: r.aleP75,
    P95: r.aleP95,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("compareTitle")}</h1>
        <p className="text-muted-foreground">{t("compareSubtitle")}</p>
      </div>

      {/* Comparison Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t("aleComparison")}</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={formatCompactEUR}
                fontSize={11}
              />
              <YAxis type="category" dataKey="name" width={200} fontSize={11} />
              <RechartsTooltip
                formatter={(val: unknown) => formatEUR(Number(val))}
              />
              <Legend />
              <Bar dataKey="P5" fill="#86efac" name="P5" stackId="range" />
              <Bar dataKey="P25" fill="#4ade80" name="P25" stackId="iqr" />
              <Bar dataKey="P50" fill="#f59e0b" name="P50 (Median)" />
              <Bar dataKey="P75" fill="#fb923c" name="P75" stackId="iqr2" />
              <Bar dataKey="P95" fill="#ef4444" name="P95 (VaR)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Comparison Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t("detailedComparison")}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">{t("riskName")}</th>
                <th className="text-left p-2">{t("category")}</th>
                <th className="text-right p-2">ALE P50</th>
                <th className="text-right p-2">ALE P95</th>
                <th className="text-right p-2">VaR 95%</th>
                <th className="text-right p-2">{t("aleMean")}</th>
              </tr>
            </thead>
            <tbody>
              {risks
                .sort((a, b) => b.aleP50 - a.aleP50)
                .map((r, idx) => (
                  <tr key={r.riskId} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.riskTitle}</td>
                    <td className="p-2">
                      <Badge variant="outline">{r.riskCategory}</Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(r.aleP50)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(r.aleP95)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(r.aleP95)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatEUR(r.aleMean)}
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
