"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Eye,
  Lightbulb,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";

interface Finding {
  severity: "major" | "minor" | "observation" | "ofi";
  category: string;
  title: string;
  description: string;
  stepCode?: string;
  stepId?: string;
  recommendation: string;
}

interface AuditData {
  summary: {
    major: number;
    minor: number;
    observation: number;
    ofi: number;
    total: number;
    auditReadiness:
      | "READY_FOR_STAGE_1"
      | "READY_AFTER_REMEDIATION"
      | "NOT_READY";
  };
  findings: Finding[];
  generatedAt: string;
}

const SEVERITY_ICONS = {
  major: AlertTriangle,
  minor: AlertCircle,
  observation: Eye,
  ofi: Lightbulb,
};
const SEVERITY_COLORS = {
  major: "text-red-700 bg-red-50 border-red-200",
  minor: "text-amber-700 bg-amber-50 border-amber-200",
  observation: "text-blue-700 bg-blue-50 border-blue-200",
  ofi: "text-purple-700 bg-purple-50 border-purple-200",
};

const READINESS_BADGE = {
  READY_FOR_STAGE_1: { label: "Bereit für Stage-1", color: "bg-emerald-600" },
  READY_AFTER_REMEDIATION: {
    label: "Bereit nach Behebung",
    color: "bg-amber-500",
  },
  NOT_READY: { label: "Nicht bereit", color: "bg-red-600" },
};

export default function AuditSimulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("programme");
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/synthetic-audit`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Zurück zum Cockpit
        </Link>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Synthetic-Auditor</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-3xl">
              Simuliert einen Stage-1-Audit-Pass und identifiziert wahrscheinliche Findings basierend auf der aktuellen Journey-Struktur. Prüft Belege, Ownership, Meilensteine, Konsistenz, Pacing.
            </p>
          </div>
          <Button onClick={runAudit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 size-4" />
            )}
            Erneut simulieren
          </Button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Readiness Badge */}
            <Card>
              <CardContent className="flex items-center justify-between py-6">
                <div>
                  <div className="text-xs uppercase text-slate-500">
                    Audit-Readiness
                  </div>
                  <div
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold text-white ${READINESS_BADGE[data.summary.auditReadiness].color}`}
                  >
                    {READINESS_BADGE[data.summary.auditReadiness].label}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-semibold text-red-700">
                      {data.summary.major}
                    </div>
                    <div className="text-xs text-slate-500">Major NCs</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-amber-700">
                      {data.summary.minor}
                    </div>
                    <div className="text-xs text-slate-500">Minor NCs</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-blue-700">
                      {data.summary.observation}
                    </div>
                    <div className="text-xs text-slate-500">Observations</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-purple-700">
                      {data.summary.ofi}
                    </div>
                    <div className="text-xs text-slate-500">OFIs</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {data.findings.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-12">
                  <CheckCircle2 className="size-12 text-emerald-600" />
                  <div>
                    <div className="text-lg font-semibold">
                      Keine Findings identifiziert
                    </div>
                    <div className="text-sm text-slate-500">
                      Journey ist nach aktuellen Heuristiken bereit für Stage-1-Audit.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Findings ({data.findings.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.findings.map((f, i) => {
                    const Icon = SEVERITY_ICONS[f.severity];
                    return (
                      <div
                        key={i}
                        className={`rounded-md border p-4 ${SEVERITY_COLORS[f.severity]}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 size-5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs uppercase"
                              >
                                {f.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {f.category}
                              </Badge>
                              {f.stepCode && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  {f.stepCode}
                                </Badge>
                              )}
                            </div>
                            <h3 className="mt-1 font-semibold">{f.title}</h3>
                            <p className="mt-1 text-sm">{f.description}</p>
                            <p className="mt-2 text-sm">
                              <strong>Empfehlung:</strong> {f.recommendation}
                            </p>
                            {f.stepId && (
                              <Link
                                href={`/programmes/${id}/steps/${f.stepId}`}
                                className="mt-2 inline-block text-xs underline"
                              >
                                Schritt öffnen →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-slate-500">
              Generiert: {data.generatedAt}
            </p>
          </>
        )}
      </div>
    </ModuleGate>
  );
}
