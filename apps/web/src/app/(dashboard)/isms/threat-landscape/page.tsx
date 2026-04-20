"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Bug,
  Activity,
  Loader2,
  RefreshCcw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Rss,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type {
  ThreatDashboardKPIs,
  ThreatHeatmapCell,
  ThreatTrendPoint,
  ThreatTopEntry,
  ThreatControlCoverage,
  ThreatFeedItem,
} from "@grc/shared";

export default function ThreatLandscapePage() {
  const t = useTranslations("reporting");

  const [kpis, setKpis] = useState<ThreatDashboardKPIs | null>(null);
  const [heatmap, setHeatmap] = useState<ThreatHeatmapCell[]>([]);
  const [trends, setTrends] = useState<ThreatTrendPoint[]>([]);
  const [topThreats, setTopThreats] = useState<ThreatTopEntry[]>([]);
  const [coverage, setCoverage] = useState<ThreatControlCoverage[]>([]);
  const [feedItems, setFeedItems] = useState<ThreatFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisRes, heatmapRes, trendsRes, topRes, coverageRes, feedRes] =
        await Promise.all([
          fetch("/api/v1/isms/threats/dashboard"),
          fetch("/api/v1/isms/threats/heatmap"),
          fetch("/api/v1/isms/threats/trends?months=12"),
          fetch("/api/v1/isms/threats/top?limit=10"),
          fetch("/api/v1/isms/threats/coverage"),
          fetch("/api/v1/isms/threats/feed?limit=10"),
        ]);

      if (kpisRes.ok) setKpis((await kpisRes.json()).data);
      if (heatmapRes.ok) setHeatmap((await heatmapRes.json()).data.cells || []);
      if (trendsRes.ok) setTrends((await trendsRes.json()).data.trends || []);
      if (topRes.ok) setTopThreats((await topRes.json()).data.threats || []);
      if (coverageRes.ok)
        setCoverage((await coverageRes.json()).data.coverage || []);
      if (feedRes.ok) setFeedItems((await feedRes.json()).data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heatmapColor = (color: string) => {
    switch (color) {
      case "red":
        return "bg-red-500 text-white";
      case "orange":
        return "bg-orange-400 text-white";
      case "yellow":
        return "bg-yellow-300 text-black";
      default:
        return "bg-gray-100 text-gray-400";
    }
  };

  if (loading) {
    return (
      <ModuleGate moduleKey="isms">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ModuleGate>
    );
  }

  // Get unique categories and tiers for heatmap
  const categories = [...new Set(heatmap.map((c) => c.threatCategory))];
  const tiers = [...new Set(heatmap.map((c) => c.assetTier))];
  if (tiers.length === 0) tiers.push("normal", "high", "very_high");

  return (
    <ModuleGate moduleKey="isms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("threatTitle")}
            </h1>
            <p className="text-muted-foreground">{t("threatSubtitle")}</p>
          </div>
          <Button onClick={fetchData} variant="ghost" size="icon">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <Shield className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                <div className="text-2xl font-bold">{kpis.activeThreats}</div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiActiveThreats")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Bug className="h-6 w-6 mx-auto text-red-600 mb-2" />
                <div className="text-2xl font-bold">{kpis.newCves7d}</div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiNewCves")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                <div className="text-2xl font-bold">{kpis.openIncidents}</div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiOpenIncidents")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Activity className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                <div className="text-2xl font-bold">{kpis.avgCvss}</div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiAvgCvss")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Bug className="h-6 w-6 mx-auto text-red-800 mb-2" />
                <div className="text-2xl font-bold">{kpis.criticalCves}</div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiCriticalCves")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingDown className="h-6 w-6 mx-auto text-green-600 mb-2" />
                <div className="text-2xl font-bold">
                  {kpis.mitigatedThreatsMonth}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("kpiMitigated")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Heatmap (center) */}
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("heatmapTitle")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("heatmapDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {heatmap.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left font-medium">
                            {t("heatmapCategory")}
                          </th>
                          {tiers.map((tier) => (
                            <th
                              key={tier}
                              className="px-2 py-1 text-center font-medium"
                            >
                              {tier}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat) => (
                          <tr key={cat} className="border-t">
                            <td className="px-2 py-1 font-medium truncate max-w-[200px]">
                              {cat}
                            </td>
                            {tiers.map((tier) => {
                              const cell = heatmap.find(
                                (c) =>
                                  c.threatCategory === cat &&
                                  c.assetTier === tier,
                              );
                              return (
                                <td
                                  key={tier}
                                  className="px-2 py-1 text-center"
                                >
                                  <div
                                    className={`inline-block rounded px-2 py-1 min-w-[32px] text-xs font-medium ${heatmapColor(cell?.color || "white")}`}
                                  >
                                    {cell?.count || 0}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t("noHeatmapData")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top-10 Threats (right) */}
          <div className="col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm">{t("topThreats")}</CardTitle>
              </CardHeader>
              <CardContent>
                {topThreats.length > 0 ? (
                  <div className="space-y-3">
                    {topThreats.map((threat, i) => (
                      <Link
                        key={threat.threatId}
                        href={`/isms/threat-landscape/${threat.threatId}`}
                        className="block"
                      >
                        <div className="flex items-center gap-2 hover:bg-muted/50 rounded p-2 transition-colors">
                          <span className="text-xs font-medium text-muted-foreground w-5">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {threat.code ? `${threat.code} — ` : ""}
                              {threat.title}
                            </p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>
                                {threat.riskScenarioCount} {t("scenarios")}
                              </span>
                              <span>
                                {threat.affectedAssets} {t("assets")}
                              </span>
                            </div>
                          </div>
                          {/* Impact bar */}
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{
                                width: `${Math.min(100, (threat.impactScore / (topThreats[0]?.impactScore || 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noTopThreats")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Trend Chart (bottom left) */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("trendTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {trends.length > 0 ? (
                  <div className="space-y-2">
                    {trends.slice(-6).map((point) => (
                      <div
                        key={point.month}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="w-16 text-muted-foreground font-mono">
                          {point.month}
                        </span>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="h-3 bg-red-400 rounded"
                            style={{
                              width: `${Math.max(4, point.newThreats * 8)}px`,
                            }}
                            title={`${point.newThreats} new`}
                          />
                          <div
                            className="h-3 bg-green-400 rounded"
                            style={{
                              width: `${Math.max(4, point.mitigatedThreats * 8)}px`,
                            }}
                            title={`${point.mitigatedThreats} mitigated`}
                          />
                        </div>
                        <span className="w-12 text-right">
                          <span className="text-red-600">
                            +{point.newThreats}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-400 rounded" />
                        {t("legendNew")}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-400 rounded" />
                        {t("legendMitigated")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noTrendData")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CVE Overlay / Feed (bottom center) */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  {t("feedTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedItems.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {feedItems.map((item) => (
                      <div
                        key={item.id}
                        className="border-b pb-2 last:border-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium line-clamp-2">
                              {item.title}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {item.sourceName && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {item.sourceName}
                                </Badge>
                              )}
                              {item.publishedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(
                                    item.publishedAt,
                                  ).toLocaleDateString("de-DE")}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noFeedData")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Control Coverage (bottom right) */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("coverageTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {coverage.length > 0 ? (
                  <div className="space-y-3">
                    {coverage.slice(0, 8).map((item) => (
                      <div key={item.threatCategory} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate max-w-[150px]">
                            {item.threatCategory}
                          </span>
                          <span className="font-medium">
                            {item.coveragePercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full">
                          <div
                            className={`h-full rounded-full ${
                              item.coveragePercent >= 80
                                ? "bg-green-500"
                                : item.coveragePercent >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${item.coveragePercent}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noCoverageData")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
}
