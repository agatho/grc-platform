"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  Thermometer,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency as formatMoney } from "@/lib/format-date";

interface ClimateScenario {
  id: string;
  name: string;
  description: string | null;
  scenario_type: "physical" | "transition";
  risk_category: string;
  temperature_pathway: string;
  time_horizon: string;
  likelihood_score: number | null;
  impact_score: number | null;
  financial_impact_min: number | null;
  financial_impact_max: number | null;
  financial_impact_currency: string;
  tcfd_category: string | null;
  status: string;
  created_at: string;
}

const PATHWAY_COLORS: Record<string, string> = {
  "1.5": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "2.0":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "3.0":
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "4.0": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  identified: "bg-blue-100 text-blue-800",
  assessed: "bg-yellow-100 text-yellow-800",
  mitigated: "bg-green-100 text-green-800",
  closed: "bg-purple-100 text-purple-800",
};

const HORIZON_KEYS = ["short", "medium", "long"];
const STATUS_KEYS = ["draft", "identified", "assessed", "mitigated", "closed"];

/**
 * [ARCTOS-FULL-2026-08-31 · OP-203, Welle 8b] Steht ausserhalb der Komponente
 * und kann keinen Hook lesen — das Gebietsschema kommt als Parameter.
 */
function formatCurrency(
  locale: string,
  min: number | null,
  max: number | null,
  currency: string,
) {
  if (!min && !max) return "-";
  const fmt = (v: number) =>
    formatMoney(locale, v, currency, { maximumFractionDigits: 0 });
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  return fmt(min || max || 0);
}

function riskScore(
  likelihood: number | null,
  impact: number | null,
): number | null {
  if (!likelihood || !impact) return null;
  return likelihood * impact;
}

function riskColor(score: number | null): string {
  if (!score) return "text-muted-foreground";
  if (score >= 16) return "text-red-600 font-bold";
  if (score >= 9) return "text-orange-600 font-semibold";
  if (score >= 4) return "text-yellow-600";
  return "text-green-600";
}

export default function ClimateScenarioPage() {
  return (
    <ModuleGate moduleKey="esg">
      <ModuleTabNav />
      <ClimateScenarioInner />
    </ModuleGate>
  );
}

function ClimateScenarioInner() {
  const t = useTranslations("esgAdvanced");
  const locale = useLocale();
  const [data, setData] = useState<ClimateScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "physical" | "transition">(
    "all",
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/v1/esg/climate-scenarios?limit=100"
          : `/api/v1/esg/climate-scenarios?limit=100&scenario_type=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const physical = data.filter((s) => s.scenario_type === "physical");
  const transition = data.filter((s) => s.scenario_type === "transition");
  const highRisk = data.filter(
    (s) => riskScore(s.likelihood_score, s.impact_score)! >= 16,
  );
  const _assessed = data.filter(
    (s) => s.status === "assessed" || s.status === "mitigated",
  );

  const pathwayDistribution = ["1.5", "2.0", "3.0", "4.0"].map((p) => ({
    pathway: `${p}°C`,
    count: data.filter((s) => s.temperature_pathway === p).length,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("climateScenarios.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("climateScenarios.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {t("climateScenarios.refresh")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Thermometer className="h-4 w-4" />
            {t("climateScenarios.kpiTotal")}
          </div>
          <p className="mt-1 text-2xl font-bold">{data.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-orange-500" />
            {t("climateScenarios.kpiPhysical")}
          </div>
          <p className="mt-1 text-2xl font-bold">{physical.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            {t("climateScenarios.kpiTransition")}
          </div>
          <p className="mt-1 text-2xl font-bold">{transition.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            {t("climateScenarios.kpiHighRisk")}
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {highRisk.length}
          </p>
        </div>
      </div>

      {/* Temperature Pathway Distribution */}
      <div className="grid gap-4 md:grid-cols-4">
        {pathwayDistribution.map((p) => (
          <div
            key={p.pathway}
            className={`rounded-lg border p-3 text-center ${PATHWAY_COLORS[p.pathway.replace("°C", "")] ?? ""}`}
          >
            <p className="text-lg font-bold">{p.pathway}</p>
            <p className="text-sm">
              {t("climateScenarios.pathwayCount", { count: p.count })}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "physical", "transition"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? t("climateScenarios.filterAll")
              : f === "physical"
                ? t("climateScenarios.filterPhysical")
                : t("climateScenarios.filterTransition")}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {t("climateScenarios.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">
                    {t("climateScenarios.colScenario")}
                  </th>
                  <th className="p-3 text-left font-medium">
                    {t("climateScenarios.colType")}
                  </th>
                  <th className="p-3 text-left font-medium">
                    {t("climateScenarios.colCategory")}
                  </th>
                  <th className="p-3 text-center font-medium">
                    {t("climateScenarios.colPathway")}
                  </th>
                  <th className="p-3 text-left font-medium">
                    {t("climateScenarios.colHorizon")}
                  </th>
                  <th className="p-3 text-center font-medium">
                    {t("climateScenarios.colRisk")}
                  </th>
                  <th className="p-3 text-right font-medium">
                    {t("climateScenarios.colFinancial")}
                  </th>
                  <th className="p-3 text-center font-medium">
                    {t("climateScenarios.colStatus")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const score = riskScore(s.likelihood_score, s.impact_score);
                  return (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {s.scenario_type === "physical"
                            ? t("climateScenarios.filterPhysical")
                            : t("climateScenarios.filterTransition")}
                        </Badge>
                      </td>
                      <td className="p-3 capitalize">{s.risk_category}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PATHWAY_COLORS[s.temperature_pathway] ?? ""}`}
                        >
                          {s.temperature_pathway}°C
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {HORIZON_KEYS.includes(s.time_horizon)
                          ? t(`climateScenarios.horizon.${s.time_horizon}`)
                          : s.time_horizon}
                      </td>
                      <td className={`p-3 text-center ${riskColor(score)}`}>
                        {score
                          ? `${score} (${s.likelihood_score}×${s.impact_score})`
                          : "-"}
                      </td>
                      <td className="p-3 text-right text-xs">
                        {formatCurrency(
                          locale,
                          s.financial_impact_min
                            ? Number(s.financial_impact_min)
                            : null,
                          s.financial_impact_max
                            ? Number(s.financial_impact_max)
                            : null,
                          s.financial_impact_currency,
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? ""}`}
                        >
                          {STATUS_KEYS.includes(s.status)
                            ? t(`climateScenarios.status.${s.status}`)
                            : s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
