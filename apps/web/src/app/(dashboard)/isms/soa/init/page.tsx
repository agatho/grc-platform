"use client";

// ISMS SoA-Initialization + Gate-G2-Check
// Sprint 1.2 aus docs/assessment-plans/06-implementation-roadmap.md

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Rocket,
  RefreshCw,
  Shield,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AssessmentRun {
  id: string;
  name: string;
  status: string;
  framework: string | null;
}

interface GateCheckResponse {
  data: {
    assessmentRunId: string;
    stats: {
      totalCatalogEntries: number;
      entriesWithSoa: number;
      notApplicableWithoutJustification: number;
    };
    coverage: number;
    blockers: Array<{
      code: string;
      message: string;
      gate: string;
      severity: "error" | "warning";
    }>;
    passed: boolean;
  };
}

interface InitResponse {
  data: {
    totalEntries: number;
    created: number;
    skipped: number;
    catalogs: Array<{ id: string; name: string; source: string | null; version: string | null }>;
    frameworkCoverage: Record<string, { total: number; withSoa: number }>;
  };
}

export default function SoaInitPage() {
  return (
    <ModuleGate moduleKey="isms">
      <Suspense fallback={<PageLoader />}>
        <SoaInitInner />
      </Suspense>
    </ModuleGate>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

function SoaInitInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentIdParam = searchParams.get("assessmentId");

  const [runs, setRuns] = useState<AssessmentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(assessmentIdParam);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [gateResult, setGateResult] = useState<GateCheckResponse["data"] | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState<InitResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/v1/isms/assessments?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setRuns(body.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadGateStatus = useCallback(async (runId: string) => {
    setGateLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/isms/assessments/${runId}/soa-gate-check`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const body: GateCheckResponse = await res.json();
      setGateResult(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Gate-Check");
      setGateResult(null);
    } finally {
      setGateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (selectedRunId) loadGateStatus(selectedRunId);
    else setGateResult(null);
  }, [selectedRunId, loadGateStatus]);

  async function runInit() {
    if (!selectedRunId) return;
    setInitLoading(true);
    setError(null);
    setInitResult(null);
    try {
      const res = await fetch(`/api/v1/isms/assessments/${selectedRunId}/initialize-soa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const body: InitResponse = await res.json();
      setInitResult(body.data);
      // Nach Init Gate neu laden
      await loadGateStatus(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Init fehlgeschlagen");
    } finally {
      setInitLoading(false);
    }
  }

  async function triggerTransition() {
    if (!selectedRunId) return;
    try {
      const res = await fetch(`/api/v1/isms/assessments/${selectedRunId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "in_progress" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          `Transition blockiert: ${(body.blockers ?? [])
            .map((b: { message: string }) => b.message)
            .join(" | ") || body.error}`,
        );
        return;
      }
      router.push(`/isms/assessments/${selectedRunId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transition fehlgeschlagen");
    }
  }

  const canInit = selectedRunId !== null;
  const canTransition = gateResult?.passed === true;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <Link
          href="/isms/assessments"
          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Assessment-Uebersicht
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Statement of Applicability -- Initialization
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Sprint 1.2: SoA-Bulk-Init aus aktivierten Katalogen + Gate-G2-Check vor Run-Start.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Run-Auswahl */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold mb-3">1. Assessment-Run waehlen</h2>
        {loadingRuns ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Laedt...
          </div>
        ) : runs.length === 0 ? (
          <div className="text-sm text-gray-500">
            Keine Assessment-Runs vorhanden.{" "}
            <Link href="/isms/assessments/new" className="text-blue-600 underline">
              Ersten Run anlegen
            </Link>
          </div>
        ) : (
          <select
            value={selectedRunId ?? ""}
            onChange={(e) => setSelectedRunId(e.target.value || null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">-- Bitte Run waehlen --</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · status={r.status} · framework={r.framework ?? "–"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 2: Gate-Status */}
      {selectedRunId && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">2. Gate G2 -- Aktueller Status</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedRunId && loadGateStatus(selectedRunId)}
              disabled={gateLoading}
            >
              {gateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reload
            </Button>
          </div>

          {gateLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Laedt Gate-Check...
            </div>
          ) : gateResult ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Coverage"
                  value={`${gateResult.coverage}%`}
                  variant={gateResult.coverage >= 80 ? "good" : "warning"}
                />
                <StatCard
                  label="Katalog-Eintraege"
                  value={`${gateResult.stats.entriesWithSoa} / ${gateResult.stats.totalCatalogEntries}`}
                  variant="neutral"
                />
                <StatCard
                  label="N/A ohne Justification"
                  value={gateResult.stats.notApplicableWithoutJustification.toString()}
                  variant={
                    gateResult.stats.notApplicableWithoutJustification === 0 ? "good" : "warning"
                  }
                />
              </div>

              <div
                className={`p-3 rounded-md border ${
                  gateResult.passed
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                {gateResult.passed ? (
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Gate G2 bestanden -- Transition zu in_progress moeglich.</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-yellow-900 font-medium mb-2">
                      <AlertCircle className="h-5 w-5" />
                      Gate G2 offen:
                    </div>
                    <ul className="text-sm text-yellow-900 list-disc list-inside space-y-1">
                      {gateResult.blockers
                        .filter((b) => b.severity === "error")
                        .map((b, i) => (
                          <li key={i}>
                            <Badge variant="outline" className="mr-1">
                              {b.code}
                            </Badge>
                            {b.message}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 3: Init-Button */}
      {selectedRunId && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold mb-3">3. SoA initialisieren</h2>
          <p className="text-sm text-gray-600 mb-3">
            Legt fuer jeden catalog_entry der aktiven Kataloge (control + reference) einen
            soa_entry an, wenn noch keiner existiert. Default-Applicability:{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">applicable</code>.
          </p>
          <Button onClick={runInit} disabled={!canInit || initLoading}>
            {initLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Initialisiere...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" /> SoA jetzt befuellen
              </>
            )}
          </Button>

          {initResult && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm font-medium text-blue-900">
                Init abgeschlossen: {initResult.created} neu, {initResult.skipped} bereits vorhanden
                (Total: {initResult.totalEntries})
              </p>
              <div className="mt-2 text-xs text-blue-900">
                Kataloge: {initResult.catalogs.map((c) => c.name).join(", ")}
              </div>
              <div className="mt-2 text-xs text-blue-900">
                <strong>Framework-Coverage:</strong>
                <ul className="list-disc list-inside mt-1">
                  {Object.entries(initResult.frameworkCoverage).map(([fw, stats]) => (
                    <li key={fw}>
                      {fw}: {stats.withSoa} / {stats.total}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Transition */}
      {selectedRunId && canTransition && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-5">
          <h2 className="font-semibold mb-2 text-green-900">4. Bereit fuer Start</h2>
          <p className="text-sm text-green-900 mb-3">
            Gate G2 bestanden. Du kannst jetzt den Run auf <code>in_progress</code> setzen und
            mit der Risiko-Bewertung beginnen.
          </p>
          <Button onClick={triggerTransition} className="bg-green-600 hover:bg-green-700">
            Run zu in_progress bewegen
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "good" | "warning" | "neutral";
}) {
  const bgColor = {
    good: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    neutral: "bg-gray-50 border-gray-200",
  }[variant];
  const textColor = {
    good: "text-green-900",
    warning: "text-yellow-900",
    neutral: "text-gray-900",
  }[variant];

  return (
    <div className={`p-3 border rounded-md ${bgColor}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
