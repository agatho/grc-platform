"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Zap,
  HardDrive,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { CacheStatsResponse, SlowQueriesResponse } from "@grc/shared";

export default function PerformanceDashboardPage() {
  const t = useTranslations("performance");
  const [clearing, setClearing] = useState(false);

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Beide Kennzahlen wurden immer
  // zusammen geholt — daher EINE Abfrage. Eine nicht-ok-Antwort laesst den
  // jeweiligen Teil wie vorher leer; ein Netzfehler wird wie vorher nur
  // protokolliert.
  const {
    data,
    isPending: loading,
    refetch,
  } = useQuery<{
    cacheStats: CacheStatsResponse | null;
    slowQueries: SlowQueriesResponse | null;
  }>({
    queryKey: ["admin", "performance"],
    queryFn: async () => {
      let cacheStats: CacheStatsResponse | null = null;
      let slowQueries: SlowQueriesResponse | null = null;
      try {
        const [cacheRes, queryRes] = await Promise.all([
          fetch("/api/v1/admin/performance/cache-stats"),
          fetch("/api/v1/admin/performance/slow-queries"),
        ]);

        if (cacheRes.ok) {
          const json = await cacheRes.json();
          cacheStats = json.data as CacheStatsResponse;
        }
        if (queryRes.ok) {
          const json = await queryRes.json();
          slowQueries = json.data as SlowQueriesResponse;
        }
      } catch (err) {
        console.error("Failed to load performance data:", err);
      }
      return { cacheStats, slowQueries };
    },
  });
  const cacheStats = data?.cacheStats ?? null;
  const slowQueries = data?.slowQueries ?? null;

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleClearCache = useCallback(async () => {
    setClearing(true);
    try {
      await fetch("/api/v1/admin/performance/cache-invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchData();
    } catch {
      // Error handling
    } finally {
      setClearing(false);
    }
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("refresh")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("clearCache")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("clearCacheConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("clearCacheConfirmDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearCache}
                  disabled={clearing}
                >
                  {clearing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {cacheStats?.overallHitRate.toFixed(1) ?? 0}%
                </p>
                <p className="text-xs text-gray-500">{t("hitRate")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {cacheStats?.totalKeys ?? 0}
                </p>
                <p className="text-xs text-gray-500">{t("cachedKeys")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {cacheStats?.memoryUsedMb.toFixed(1) ?? 0} MB
                </p>
                <p className="text-xs text-gray-500">{t("memoryUsed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {cacheStats?.totalHits ?? 0}
                </p>
                <p className="text-xs text-gray-500">{t("savedQueries")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slow Queries Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("slowQueries")}</CardTitle>
          <CardDescription>
            {t("slowQueriesDescription", {
              threshold: slowQueries?.threshold ?? 100,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slowQueries && slowQueries.queries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("query")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      {t("avgDuration")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      {t("callCount")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("tables")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {slowQueries.queries.map((q, idx) => (
                    <tr key={idx}>
                      <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-gray-700">
                        {q.query}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        {q.avgDurationMs.toFixed(1)} ms
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        {q.callCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {q.tables.join(", ")}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {q.indexRecommended ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t("indexRecommended")}
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">
                            OK
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-400">
              <Database className="mb-2 h-8 w-8" />
              {t("noSlowQueries")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
