"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Leaf,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiData {
  avgCES: number;
  totalControls: number;
  controlsBelowThreshold: number;
  riskScoreAvg: number;
  risksAboveAppetite: number;
  openFindings: number;
  findingSlaCompliance: number;
  auditSlaCompliance: number;
  dsrSlaCompliance: number;
  esgCompleteness: number;
}

interface Snapshot {
  snapshotDate: string;
  kpis: KpiData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kpiColor(value: number, threshold: number, inverted = false): string {
  if (inverted) {
    if (value <= threshold * 0.5) return "text-green-600";
    if (value <= threshold) return "text-yellow-600";
    return "text-red-600";
  }
  if (value >= threshold) return "text-green-600";
  if (value >= threshold * 0.7) return "text-yellow-600";
  return "text-red-600";
}

function TrendIcon({ snapshots, kpiKey, inverted = false }: { snapshots: Snapshot[]; kpiKey: keyof KpiData; inverted?: boolean }) {
  if (snapshots.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
  const latest = snapshots[0].kpis[kpiKey] as number;
  const previous = snapshots[1].kpis[kpiKey] as number;
  const delta = latest - previous;
  const improving = inverted ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 1) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (improving) return <TrendingUp className="h-4 w-4 text-green-600" />;
  return <TrendingDown className="h-4 w-4 text-red-600" />;
}

function Sparkline({ data, color = "stroke-primary" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 32;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points.join(" ")}
        fill="none"
        className={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExecutiveDashboardPage() {
  const t = useTranslations("intelligence");

  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch("/api/v1/executive/dashboard"),
        fetch("/api/v1/executive/trend?months=12"),
      ]);

      const dashJson = await dashRes.json();
      const trendJson = await trendRes.json();

      setKpis(dashJson.data ?? null);
      setSnapshots(trendJson.data?.snapshots ?? []);
    } catch {
      // handled in UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const kpiCards = kpis
    ? [
        {
          key: "avgCES" as const,
          label: t("executive.avgCes"),
          value: kpis.avgCES,
          suffix: "",
          icon: ShieldCheck,
          color: kpiColor(kpis.avgCES, 70),
          sub: `${kpis.controlsBelowThreshold} ${t("executive.belowThreshold")}`,
        },
        {
          key: "riskScoreAvg" as const,
          label: t("executive.riskScore"),
          value: kpis.riskScoreAvg,
          suffix: "",
          icon: AlertTriangle,
          color: kpiColor(kpis.riskScoreAvg, 10, true),
          sub: `${kpis.risksAboveAppetite} ${t("executive.aboveAppetite")}`,
          inverted: true,
        },
        {
          key: "openFindings" as const,
          label: t("executive.openFindings"),
          value: kpis.openFindings,
          suffix: "",
          icon: Bug,
          color: kpiColor(kpis.openFindings, 5, true),
          sub: `SLA: ${kpis.findingSlaCompliance}%`,
          inverted: true,
        },
        {
          key: "auditSlaCompliance" as const,
          label: t("executive.auditSla"),
          value: kpis.auditSlaCompliance,
          suffix: "%",
          icon: CheckCircle2,
          color: kpiColor(kpis.auditSlaCompliance, 80),
          sub: t("executive.compliance"),
        },
        {
          key: "esgCompleteness" as const,
          label: t("executive.esgCompleteness"),
          value: kpis.esgCompleteness,
          suffix: "%",
          icon: Leaf,
          color: kpiColor(kpis.esgCompleteness, 80),
          sub: t("executive.datapoints"),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            {t("executive.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("executive.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("executive.refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            {kpiCards.map((card) => (
              <Card key={card.key}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>{card.label}</span>
                    <card.icon className="h-4 w-4 text-muted-foreground" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${card.color}`}>
                      {card.value}{card.suffix}
                    </span>
                    <TrendIcon
                      snapshots={snapshots}
                      kpiKey={card.key}
                      inverted={card.inverted}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.sub}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Trend Charts */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpiCards.map((card) => (
              <Card key={`trend-${card.key}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{card.label} {t("executive.trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Sparkline
                    data={snapshots
                      .slice()
                      .reverse()
                      .map((s) => s.kpis[card.key] as number)}
                    color={card.inverted ? "stroke-red-400" : "stroke-primary"}
                  />
                  {snapshots.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("executive.noTrendData")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
