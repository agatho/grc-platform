"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch, in
 * HTML-Entitaeten geschrieben (`Datenqualit&auml;tsregeln`,
 * `Verst&ouml;&szlig;e`).
 *
 * Nebenbefund derselben Klasse wie OP-190: Die Fehlerquote wurde mit
 * `toFixed(1)` gebildet — das ist gebietsschemablind und ergibt IMMER einen
 * Dezimalpunkt. Ein deutscher Leser sah „12.5 %" statt „12,5 %".
 * `formatNumber` aus `lib/format-date.ts` gibt es genau dafuer. Das
 * Prozentzeichen steht im Katalog und nicht in `Intl.NumberFormat`: der Wert
 * kommt bereits als Prozentzahl (12,5 = 12,5 %), `style: "percent"` wuerde ihn
 * ein zweites Mal mit 100 multiplizieren. Der Abstand vor dem Zeichen ist
 * dabei sprachabhaengig — deutsch mit, englisch ohne.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataQualityStats {
  activeRules: number;
  lastCheck: string | null;
  errorRate: number;
  openViolations: number;
}

interface DataQualityRule {
  id: string;
  name: string;
  entityType: string;
  field: string;
  ruleType: "range" | "pattern" | "required" | "unique";
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "inactive";
  violationCount: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
};

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataQualityPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate, formatNumber } = useDateFormat();
  const [stats, setStats] = useState<DataQualityStats | null>(null);
  const [rules, setRules] = useState<DataQualityRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/data-quality/rules");
      if (res.ok) {
        const json = await res.json();
        setRules(json.data ?? []);
        setStats(json.stats ?? null);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
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
          <h1 className="text-2xl font-bold text-gray-900">
            {t("dataQuality.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("dataQuality.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            {tCommon("actions.refresh")}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("reminders.create")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeRules ?? 0}</p>
                <p className="text-xs text-gray-500">
                  {t("dataQuality.kpi.activeRules")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.lastCheck ? formatDate(stats.lastCheck) : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">
                  {t("dataQuality.kpi.lastCheck")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.errorRate != null
                    ? t("dataQuality.percent", {
                        value: formatNumber(stats.errorRate, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }),
                      })
                    : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">
                  {t("dataQuality.kpi.errorRate")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.openViolations ?? 0}
                </p>
                <p className="text-xs text-gray-500">
                  {t("dataQuality.kpi.openViolations")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dataQuality.tableTitle", { count: rules.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <CheckCircle2 className="mb-3 h-10 w-10" />
              <p className="font-medium text-gray-500">
                {t("dataQuality.empty")}
              </p>
              <p className="mt-1 text-gray-400">{t("dataQuality.emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("reminders.column.name")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("reminders.column.entityType")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataQuality.column.field")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataQuality.column.ruleType")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataQuality.column.severity")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("dataQuality.column.violations")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("reminders.column.status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {rule.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rule.entityType}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                          {rule.field}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {t(`dataQuality.ruleType.${rule.ruleType}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs ${severityColors[rule.severity] ?? ""}`}
                        >
                          {t(`dataQuality.severity.${rule.severity}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {rule.violationCount > 0 ? (
                          <span className="font-medium text-red-600">
                            {rule.violationCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            statusColors[rule.status] ??
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {t(`dataLinks.status.${rule.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
