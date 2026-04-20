"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Network,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  ArrowRight,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type {
  HubEntityData,
  DependencyMatrixEntryData,
  GraphStatsResponse,
} from "@grc/shared";
import { GRAPH_ENTITY_COLORS } from "@grc/shared";

export default function DependencyMapPage() {
  const t = useTranslations("graph");

  const [matrix, setMatrix] = useState<DependencyMatrixEntryData[]>([]);
  const [hubs, setHubs] = useState<HubEntityData[]>([]);
  const [stats, setStats] = useState<GraphStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"matrix" | "hubs">("matrix");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixRes, hubsRes, statsRes] = await Promise.all([
        fetch("/api/v1/graph/dependencies/matrix"),
        fetch("/api/v1/graph/dependencies/hubs?limit=20"),
        fetch("/api/v1/graph/stats"),
      ]);

      if (matrixRes.ok) {
        const { data } = await matrixRes.json();
        setMatrix(data);
      }
      if (hubsRes.ok) {
        const { data } = await hubsRes.json();
        setHubs(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch dependency data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique entity types for matrix headers
  const matrixTypes = new Set<string>();
  for (const entry of matrix) {
    matrixTypes.add(entry.sourceType);
    matrixTypes.add(entry.targetType);
  }
  const typeList = Array.from(matrixTypes).sort();

  // Build matrix lookup
  const matrixLookup = new Map<string, DependencyMatrixEntryData>();
  for (const entry of matrix) {
    matrixLookup.set(`${entry.sourceType}:${entry.targetType}`, entry);
  }

  const spofHubs = hubs.filter((h) => h.isSinglePointOfFailure);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            {t("dependencies.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("dependencies.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Link href="/graph/explorer">
            <Button variant="outline" size="sm">
              {t("explorer.title")}
            </Button>
          </Link>
          <Link href="/graph/orphans">
            <Button variant="outline" size="sm">
              {t("orphans.title")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.totalNodes}</div>
            <div className="text-xs text-muted-foreground">
              {t("stats.totalNodes")}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.totalEdges}</div>
            <div className="text-xs text-muted-foreground">
              {t("stats.totalEdges")}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.orphanCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("stats.orphans")}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.hubCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("stats.hubs")}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.avgConnections}</div>
            <div className="text-xs text-muted-foreground">
              {t("stats.avgConnections")}
            </div>
          </Card>
        </div>
      )}

      {/* SPOF warning */}
      {spofHubs.length > 0 && (
        <Card className="p-4 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {t("dependencies.spofDetected", {
                count: spofHubs.length,
                threshold: 10,
              })}
            </span>
          </div>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "matrix" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("matrix")}
        >
          {t("dependencies.matrix")}
        </Button>
        <Button
          variant={activeTab === "hubs" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("hubs")}
        >
          {t("dependencies.hubs")}{" "}
          {spofHubs.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {spofHubs.length}
            </Badge>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeTab === "matrix" ? (
        /* Dependency Matrix */
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                  {t("dependencies.sourceType")} /{" "}
                  {t("dependencies.targetType")}
                </th>
                {typeList.map((type) => (
                  <th key={type} className="p-3 text-center text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            GRAPH_ENTITY_COLORS[type] ?? "#6b7280",
                        }}
                      />
                      <span>{type}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {typeList.map((sourceType) => (
                <tr key={sourceType} className="border-b hover:bg-accent/50">
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            GRAPH_ENTITY_COLORS[sourceType] ?? "#6b7280",
                        }}
                      />
                      {sourceType}
                    </div>
                  </td>
                  {typeList.map((targetType) => {
                    const entry = matrixLookup.get(
                      `${sourceType}:${targetType}`,
                    );
                    return (
                      <td key={targetType} className="p-3 text-center">
                        {entry ? (
                          <Link
                            href={`/graph/explorer?entityType=${sourceType}&entityId=`}
                            className="inline-block"
                          >
                            <Badge
                              variant="outline"
                              className={`cursor-pointer ${
                                entry.count >= 10
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : entry.count >= 5
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                    : ""
                              }`}
                            >
                              {entry.count}
                            </Badge>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        /* Hub entities list */
        <div className="space-y-3">
          {hubs.length === 0 ? (
            <Card className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-muted-foreground">
                {t("dependencies.noHubs")}
              </p>
            </Card>
          ) : (
            hubs.map((hub) => (
              <Card key={hub.entityId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor:
                          GRAPH_ENTITY_COLORS[hub.entityType] ?? "#6b7280",
                      }}
                    />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {hub.entityName}
                        {hub.isSinglePointOfFailure && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {t("dependencies.hubWarning")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span>{hub.entityType}</span>
                        <span>
                          {t("dependencies.inbound")}: {hub.inbound}
                        </span>
                        <span>
                          {t("dependencies.outbound")}: {hub.outbound}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {t("dependencies.connections", {
                        count: hub.connectionCount,
                      })}
                    </Badge>
                    <Link
                      href={`/graph/explorer?entityId=${hub.entityId}&entityType=${hub.entityType}`}
                    >
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
