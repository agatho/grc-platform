"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, ExternalLink } from "lucide-react";
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
import { Button } from "@/components/ui/button";

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

export default function FAIRTopRisksPage() {
  return (
    <ModuleGate moduleKey="erm">
      <FAIRTopRisksInner />
    </ModuleGate>
  );
}

function FAIRTopRisksInner() {
  const t = useTranslations("fair");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<TopRisk[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/erm/fair/top-risks?limit=10");
      if (res.ok) {
        const data = await res.json();
        setRisks(data.data ?? []);
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

  const chartData = risks.map((r) => ({
    name: r.riskTitle.length > 25 ? r.riskTitle.substring(0, 25) + "..." : r.riskTitle,
    P50: r.aleP50,
    P95: r.aleP95,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("topRisksTitle")}</h1>
          <p className="text-muted-foreground">{t("topRisksSubtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/erm/fair/portfolio")}>
          <TrendingUp className="mr-2 h-4 w-4" />
          {t("portfolioView")}
        </Button>
      </div>

      {/* Horizontal Bar Chart */}
      {risks.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t("topRisksByALE")}</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={formatCompactEUR}
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  fontSize={11}
                />
                <RechartsTooltip formatter={(val: unknown) => formatEUR(Number(val))} />
                <Legend />
                <Bar dataKey="P50" fill="#3b82f6" name="ALE P50 (Median)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="P95" fill="#ef4444" name="ALE P95 (VaR)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">{t("riskName")}</th>
                <th className="text-left p-2">{t("category")}</th>
                <th className="text-left p-2">{t("status")}</th>
                <th className="text-right p-2">ALE P50</th>
                <th className="text-right p-2">ALE P95</th>
                <th className="text-left p-2">{t("owner")}</th>
                <th className="text-right p-2">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, idx) => (
                <tr key={r.riskId} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 font-medium">{idx + 1}</td>
                  <td className="p-2 font-medium">{r.riskTitle}</td>
                  <td className="p-2">
                    <Badge variant="outline">{r.riskCategory}</Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant="secondary">{r.status}</Badge>
                  </td>
                  <td className="p-2 text-right font-mono font-semibold">
                    {formatEUR(r.aleP50)}
                  </td>
                  <td className="p-2 text-right font-mono text-red-600">
                    {formatEUR(r.aleP95)}
                  </td>
                  <td className="p-2 text-muted-foreground">{r.ownerName ?? "-"}</td>
                  <td className="p-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/erm/risks/${r.riskId}/fair/results`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {risks.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t("noQuantifiedRisks")}</p>
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
