"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Shield,
  AlertTriangle,
  ArrowRight,
  Target,
  TrendingDown,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RiskScenario {
  id: string;
  scenario_code: string;
  title: string;
  description: string;
  threat_title: string | null;
  vulnerability_title: string | null;
  asset_name: string | null;
  likelihood: number;
  impact: number;
  risk_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  treatment_strategy: string;
  status: string;
  synced_to_erm: boolean;
}

const TREATMENT_LABELS: Record<string, string> = {
  mitigate: "Mindern",
  accept: "Akzeptieren",
  transfer: "Transferieren",
  avoid: "Vermeiden",
};

const STATUS_COLORS: Record<string, string> = {
  identified: "bg-yellow-100 text-yellow-900",
  analyzed: "bg-blue-100 text-blue-900",
  treated: "bg-green-100 text-green-900",
  accepted: "bg-gray-100 text-gray-900",
  closed: "bg-gray-100 text-gray-600",
};

function riskColor(score: number): string {
  if (score >= 20) return "bg-red-600 text-white";
  if (score >= 15) return "bg-red-500 text-white";
  if (score >= 9) return "bg-orange-500 text-white";
  if (score >= 4) return "bg-yellow-400 text-yellow-900";
  return "bg-green-400 text-green-900";
}

function riskLabel(score: number): string {
  if (score >= 20) return "Kritisch";
  if (score >= 15) return "Sehr Hoch";
  if (score >= 9) return "Hoch";
  if (score >= 4) return "Mittel";
  return "Niedrig";
}

function IsmsRisksInner() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/risk-scenarios?limit=100");
      if (res.ok) {
        const json = await res.json();
        // API returns Drizzle format, merge with raw fields
        const items = (json.data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id,
          scenario_code: r.scenarioCode || r.scenario_code || "",
          title:
            r.title || r.description?.toString().slice(0, 60) || "Unbenannt",
          description: r.description || "",
          threat_title: r.threatTitle || r.threat_title || null,
          vulnerability_title:
            r.vulnerabilityTitle || r.vulnerability_title || null,
          asset_name: r.assetName || r.asset_name || null,
          likelihood: r.likelihood ?? 0,
          impact: r.impact ?? 0,
          risk_score:
            r.riskScore ||
            r.risk_score ||
            Number(r.likelihood || 0) * Number(r.impact || 0),
          residual_likelihood:
            r.residualLikelihood || r.residual_likelihood || 0,
          residual_impact: r.residualImpact || r.residual_impact || 0,
          residual_score: r.residualScore || r.residual_score || 0,
          treatment_strategy:
            r.treatmentStrategy || r.treatment_strategy || "mitigate",
          status: r.status || "identified",
          synced_to_erm: r.syncedToErm || r.synced_to_erm || false,
        }));
        setScenarios(items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const criticalCount = scenarios.filter((s) => s.risk_score >= 15).length;
  const treatedCount = scenarios.filter((s) => s.status === "treated").length;
  const syncedCount = scenarios.filter((s) => s.synced_to_erm).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IS-Risikoszenarien</h1>
          <p className="text-muted-foreground">
            ISO 27005 — Bedrohung × Schwachstelle × Asset =
            Informationssicherheitsrisiko
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={14} className="mr-1" /> Szenario erstellen
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Szenarien gesamt</div>
          <div className="text-2xl font-bold">{scenarios.length}</div>
        </div>
        <div className="rounded-lg border p-4 border-red-200 bg-red-50/50">
          <div className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> Kritisch/Sehr Hoch
          </div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
        </div>
        <div className="rounded-lg border p-4 border-green-200 bg-green-50/50">
          <div className="text-sm text-green-600 flex items-center gap-1">
            <Shield size={12} /> Behandelt
          </div>
          <div className="text-2xl font-bold text-green-600">
            {treatedCount}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowRight size={12} /> Im ERM-Register
          </div>
          <div className="text-2xl font-bold">{syncedCount}</div>
        </div>
      </div>

      {/* Scenario Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium">Keine Risikoszenarien</h3>
          <p className="text-muted-foreground mt-1">
            Erstellen Sie Szenarien aus Bedrohungen, Schwachstellen und Assets
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">
                  Code
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Szenario
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Bedrohung
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Asset
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">
                  Inhärent
                </th>
                <th className="text-center px-2 py-3 w-8"></th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">
                  Residual
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">
                  Behandlung
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scenarios.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/isms/risks/${s.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {s.scenario_code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-blue-700 hover:text-blue-900">
                      {s.title}
                    </div>
                    {s.vulnerability_title && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Schwachstelle: {s.vulnerability_title}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.threat_title || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.asset_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      className={`${riskColor(s.risk_score)} text-xs font-bold`}
                    >
                      {s.risk_score} {riskLabel(s.risk_score)}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <TrendingDown size={14} className="text-gray-400" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      className={`${riskColor(s.residual_score)} text-xs font-bold`}
                    >
                      {s.residual_score} {riskLabel(s.residual_score)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {TREATMENT_LABELS[s.treatment_strategy] ||
                        s.treatment_strategy}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[s.status] || "bg-gray-100"}>
                      {s.status === "identified"
                        ? "Identifiziert"
                        : s.status === "treated"
                          ? "Behandelt"
                          : s.status === "accepted"
                            ? "Akzeptiert"
                            : s.status}
                    </Badge>
                    {s.synced_to_erm && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-[10px] text-blue-600 border-blue-200"
                      >
                        ERM
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ERM Sync Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <ArrowRight size={14} />
          ERM-Integration
        </div>
        <p className="text-sm text-blue-600 mt-1">
          Wesentliche IS-Risikoszenarien (Score ≥ 15) werden automatisch ins
          ERM-Risikoregister synchronisiert. Dort erfolgt die unternehmensweite
          Priorisierung und Budgetallokation.
        </p>
      </div>
    </div>
  );
}

export default function IsmsRisksPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav groupKey="isms-core" />
      <IsmsRisksInner />
    </ModuleGate>
  );
}
