"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Network,
  Loader2,
  RefreshCcw,
  Target,
  Unlink,
  BarChart3,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type { GraphStatsResponse } from "@grc/shared";
import { GRAPH_ENTITY_COLORS } from "@grc/shared";

export default function GraphOverviewPage() {
  const t = useTranslations("graph");

  const [stats, setStats] = useState<GraphStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/graph/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch graph stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Navigation cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/graph/explorer">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Network className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="font-semibold">{t("explorer.title")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("explorer.subtitle")}
                </p>
                <div className="mt-3 flex items-center gap-1 text-sm text-primary">
                  {t("explorer.title")}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>

            <Link href="/graph/dependencies">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="font-semibold">{t("dependencies.title")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("dependencies.subtitle")}
                </p>
                <div className="mt-3 flex items-center gap-1 text-sm text-primary">
                  {t("dependencies.title")}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>

            <Link href="/graph/orphans">
              <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                    <Unlink className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="font-semibold">{t("orphans.title")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("orphans.subtitle")}
                </p>
                <div className="mt-3 flex items-center gap-1 text-sm text-primary">
                  {t("orphans.title")}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Stats grid */}
          {stats && (
            <>
              <h2 className="text-lg font-semibold">{t("stats.title")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4">
                  <div className="text-3xl font-bold">{stats.totalNodes}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.totalNodes")}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-3xl font-bold">{stats.totalEdges}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.totalEdges")}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-3xl font-bold">
                    {stats.avgConnections}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.avgConnections")}
                  </div>
                </Card>
                <Card className="p-4">
                  <div
                    className={`text-3xl font-bold ${stats.orphanCount > 0 ? "text-orange-500" : "text-green-500"}`}
                  >
                    {stats.orphanCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.orphans")}
                  </div>
                </Card>
                <Card className="p-4">
                  <div
                    className={`text-3xl font-bold ${stats.hubCount > 0 ? "text-red-500" : ""}`}
                  >
                    {stats.hubCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("stats.hubs")}
                  </div>
                </Card>
              </div>

              {/* Nodes by type */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  <h3 className="font-medium text-sm">
                    {t("stats.nodesByType")}
                  </h3>
                  {Object.entries(stats.nodesByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                GRAPH_ENTITY_COLORS[type] ?? "#6b7280",
                            }}
                          />
                          <span className="text-sm">
                            {t(
                              `entityTypes.${type}` as Parameters<typeof t>[0],
                            )}
                          </span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="font-medium text-sm">
                    {t("stats.edgesByRelationship")}
                  </h3>
                  {Object.entries(stats.edgesByRelationship)
                    .sort(([, a], [, b]) => b - a)
                    .map(([rel, count]) => (
                      <div
                        key={rel}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">
                          {t(`relationships.${rel}` as Parameters<typeof t>[0])}
                        </span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
