"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Shield,
  AlertTriangle,
  Target,
  TrendingDown,
  Bug,
  Server,
  Activity,
  ArrowRight,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ── Types ── */

interface RiskScenarioDetail {
  id: string;
  scenario_code: string | null;
  title: string | null;
  description: string | null;
  // Threat
  threat_id: string | null;
  threat_title: string | null;
  threat_category: string | null;
  // Vulnerability
  vulnerability_id: string | null;
  vulnerability_title: string | null;
  vulnerability_severity: string | null;
  // Asset
  asset_id: string | null;
  asset_name: string | null;
  asset_tier: string | null;
  // Risk scores
  likelihood: number;
  impact: number;
  risk_score: number;
  // Treatment
  treatment_strategy: string | null;
  treatment_description: string | null;
  // Residual
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  // Meta
  status: string | null;
  owner_id: string | null;
  owner_name: string | null;
  review_date: string | null;
  control_ids: string[] | null;
  synced_to_erm: boolean;
  erm_risk_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string | null;
}

/* ── Label Maps (German) ── */

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

const STATUS_LABELS: Record<string, string> = {
  identified: "Identifiziert",
  analyzed: "Analysiert",
  treated: "Behandelt",
  accepted: "Akzeptiert",
  closed: "Geschlossen",
};

const VULN_SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};

/* ── Helpers ── */

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

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ── Component ── */

export default function IsmsRiskDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <RiskDetailInner />
    </ModuleGate>
  );
}

function RiskDetailInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RiskScenarioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/risk-scenarios/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-gray-500 py-12">
        Risikoszenario nicht gefunden.
      </p>
    );
  }

  const score = data.risk_score ?? data.likelihood * data.impact;
  const residual =
    data.residual_score ?? data.residual_likelihood * data.residual_impact;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/isms/risks")}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {data.scenario_code && (
                <span className="font-mono text-sm text-gray-500">
                  {data.scenario_code}
                </span>
              )}
              <h1 className="text-2xl font-bold text-gray-900">
                {data.title ||
                  data.description?.slice(0, 60) ||
                  "Risikoszenario"}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                className={STATUS_COLORS[data.status ?? ""] ?? "bg-gray-100"}
              >
                {STATUS_LABELS[data.status ?? ""] ?? data.status ?? "—"}
              </Badge>
              {data.synced_to_erm && (
                <Badge
                  variant="outline"
                  className="text-blue-600 border-blue-200"
                >
                  <ArrowRight size={10} className="mr-1" /> ERM-Register
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Beschreibung */}
      {data.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Beschreibung
          </h2>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {data.description}
          </p>
        </div>
      )}

      {/* Risk Score Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inherent Risk */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
            <AlertTriangle size={14} /> Inhärentes Risiko
          </h2>
          <div className="flex items-center justify-center mb-4">
            <div
              className={`rounded-lg px-6 py-4 text-center ${riskColor(score)}`}
            >
              <div className="text-3xl font-bold">{score}</div>
              <div className="text-sm font-medium">{riskLabel(score)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                Eintrittswahrscheinlichkeit
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {data.likelihood}
              </div>
              <div className="text-xs text-gray-500">von 5</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Auswirkung</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.impact}
              </div>
              <div className="text-xs text-gray-500">von 5</div>
            </div>
          </div>
        </div>

        {/* Residual Risk */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Shield size={14} /> Restrisiko
          </h2>
          <div className="flex items-center justify-center mb-4">
            <div
              className={`rounded-lg px-6 py-4 text-center ${riskColor(residual)}`}
            >
              <div className="text-3xl font-bold">{residual}</div>
              <div className="text-sm font-medium">{riskLabel(residual)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                Eintrittswahrscheinlichkeit
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {data.residual_likelihood}
              </div>
              <div className="text-xs text-gray-500">von 5</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Auswirkung</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.residual_impact}
              </div>
              <div className="text-xs text-gray-500">von 5</div>
            </div>
          </div>
          {score > 0 && (
            <div className="mt-3 text-center">
              <span className="text-xs text-gray-500">Risikoreduktion: </span>
              <span className="text-sm font-semibold text-green-600">
                {score > 0 ? Math.round(((score - residual) / score) * 100) : 0}
                %
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Threat / Vulnerability / Asset */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Threat */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target size={12} /> Bedrohung
          </h3>
          {data.threat_title ? (
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.threat_title}
              </p>
              {data.threat_category && (
                <Badge variant="outline" className="text-[10px] mt-2">
                  {data.threat_category}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Nicht zugeordnet</p>
          )}
        </div>

        {/* Vulnerability */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Bug size={12} /> Schwachstelle
          </h3>
          {data.vulnerability_title ? (
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.vulnerability_title}
              </p>
              {data.vulnerability_severity && (
                <Badge
                  variant="outline"
                  className={`text-[10px] mt-2 ${VULN_SEVERITY_COLORS[data.vulnerability_severity] ?? ""}`}
                >
                  {data.vulnerability_severity}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Nicht zugeordnet</p>
          )}
        </div>

        {/* Asset */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Server size={12} /> Asset
          </h3>
          {data.asset_name ? (
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.asset_name}
              </p>
              {data.asset_tier && (
                <Badge variant="outline" className="text-[10px] mt-2">
                  Tier {data.asset_tier}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Nicht zugeordnet</p>
          )}
        </div>
      </div>

      {/* Behandlungsstrategie */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Activity size={14} /> Behandlungsstrategie
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldRow
            label="Strategie"
            value={
              TREATMENT_LABELS[data.treatment_strategy ?? ""] ??
              data.treatment_strategy ??
              "—"
            }
          />
          <FieldRow label="Verantwortlich" value={data.owner_name ?? "—"} />
          <FieldRow label="Review-Datum" value={fmtDate(data.review_date)} />
          <FieldRow
            label="Verknüpfte Controls"
            value={
              data.control_ids?.length
                ? `${data.control_ids.length} Controls`
                : "—"
            }
          />
        </div>
        {data.treatment_description && (
          <div className="mt-4">
            <dt className="text-xs font-medium text-gray-500 mb-1">
              Maßnahmenbeschreibung
            </dt>
            <dd className="text-sm text-gray-800 whitespace-pre-wrap">
              {data.treatment_description}
            </dd>
          </div>
        )}
      </div>

      {/* Metadaten */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
          Metadaten
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldRow label="Erstellt am" value={fmtDate(data.created_at)} />
          <FieldRow label="Aktualisiert am" value={fmtDate(data.updated_at)} />
          <FieldRow
            label="ERM-Sync"
            value={data.synced_to_erm ? "Ja" : "Nein"}
          />
          <FieldRow
            label="Tags"
            value={data.tags?.length ? data.tags.join(", ") : "—"}
          />
        </div>
      </div>

      {/* ERM Sync Info */}
      {data.synced_to_erm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <ArrowRight size={14} />
            Im ERM-Risikoregister synchronisiert
          </div>
          <p className="text-sm text-blue-600 mt-1">
            Dieses IS-Risikoszenario ist mit dem unternehmensweiten
            Risikoregister verknüpft.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Field Row ── */

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
