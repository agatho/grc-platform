"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  Thermometer,
  ShieldAlert,
  TrendingUp,
  Zap,
  Plus,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const HORIZON_LABELS: Record<string, string> = {
  short: "Kurzfristig (<2030)",
  medium: "Mittelfristig (2030-2040)",
  long: "Langfristig (2040-2050+)",
};

function formatCurrency(
  min: number | null,
  max: number | null,
  currency: string,
) {
  if (!min && !max) return "-";
  const fmt = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  if (min && max) return `${fmt.format(min)} - ${fmt.format(max)}`;
  return fmt.format(min || max || 0);
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
  const t = useTranslations();
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
  const assessed = data.filter(
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
            TCFD Klimaszenarien
          </h1>
          <p className="text-muted-foreground">
            Physische und Transitionsrisiken nach TCFD-Empfehlungen und ESRS E1
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
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Thermometer className="h-4 w-4" />
            Szenarien gesamt
          </div>
          <p className="mt-1 text-2xl font-bold">{data.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-orange-500" />
            Physische Risiken
          </div>
          <p className="mt-1 text-2xl font-bold">{physical.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Transitionsrisiken
          </div>
          <p className="mt-1 text-2xl font-bold">{transition.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Hohes Risiko ({"\u2265"}16)
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
            <p className="text-sm">{p.count} Szenarien</p>
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
              ? "Alle"
              : f === "physical"
                ? "Physisch"
                : "Transition"}
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
          Keine Klimaszenarien vorhanden. Migration 0092 ausf&uuml;hren.
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Szenario</th>
                  <th className="p-3 text-left font-medium">Typ</th>
                  <th className="p-3 text-left font-medium">Kategorie</th>
                  <th className="p-3 text-center font-medium">Pfad</th>
                  <th className="p-3 text-left font-medium">Zeithorizont</th>
                  <th className="p-3 text-center font-medium">Risiko (L*I)</th>
                  <th className="p-3 text-right font-medium">
                    Finanzielle Auswirkung
                  </th>
                  <th className="p-3 text-center font-medium">Status</th>
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
                            ? "Physisch"
                            : "Transition"}
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
                        {HORIZON_LABELS[s.time_horizon] ?? s.time_horizon}
                      </td>
                      <td className={`p-3 text-center ${riskColor(score)}`}>
                        {score
                          ? `${score} (${s.likelihood_score}×${s.impact_score})`
                          : "-"}
                      </td>
                      <td className="p-3 text-right text-xs">
                        {formatCurrency(
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
                          {s.status}
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
