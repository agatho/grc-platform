"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  FlaskConical,
  Play,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SyncDraft {
  title: string;
  description: string;
  riskCategory: string;
  riskSource: string;
  inherentLikelihood: number;
  inherentImpact: number;
  riskScoreInherent: number;
  catalogSource: string;
  catalogEntryId: string;
}

interface SkippedEntry {
  catalogEntryId: string;
  reason: string;
}

interface SyncedRiskEntry {
  riskId: string;
  action: "created" | "updated";
  catalogSource: string;
  catalogEntryId: string;
  riskScoreInherent: number;
}

interface DryRunResponse {
  dryRun: true;
  totalCandidates: number;
  eligibleForSync: number;
  filteredByThreshold: number;
  drafts: SyncDraft[];
  skipped: SkippedEntry[];
}

interface LiveResponse {
  dryRun: false;
  totalCandidates: number;
  eligibleForSync: number;
  filteredByThreshold: number;
  createdCount: number;
  updatedCount: number;
  skipped: SkippedEntry[];
  syncedRisks: SyncedRiskEntry[];
}

type ApiResponse = DryRunResponse | LiveResponse;

const SOURCE_LABELS: Record<string, string> = {
  dpms_dpia_risk: "DPIA Risk",
  ai_act_fria_right: "AI-Act FRIA Right",
  ai_act_incident: "AI-Act Incident",
};

export default function GrcRiskSyncPage() {
  const [minScore, setMinScore] = useState(6);
  const [preview, setPreview] = useState<DryRunResponse | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runSync = useCallback(
    async (dryRun: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/cross/risk-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minScore, dryRun }),
        });
        if (!res.ok)
          throw new Error(`API returned ${res.status}: ${await res.text()}`);
        const json = (await res.json()) as { data: ApiResponse };
        if (dryRun) {
          setPreview(json.data as DryRunResponse);
          setLiveResult(null);
        } else {
          setLiveResult(json.data as LiveResponse);
          setPreview(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Sync");
      } finally {
        setLoading(false);
        setConfirmOpen(false);
      }
    },
    [minScore],
  );

  const scoreBadge = (score: number) => {
    const className =
      score >= 16
        ? "bg-red-100 text-red-800 border-red-300"
        : score >= 9
          ? "bg-orange-100 text-orange-800 border-orange-300"
          : score >= 6
            ? "bg-amber-100 text-amber-800 border-amber-300"
            : "bg-slate-100 text-slate-700 border-slate-300";
    return (
      <Badge variant="outline" className={`font-mono ${className}`}>
        {score}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cross-Module Risk Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Synchronisiert DPIA-Risks, AI-Act FRIA Rechte und AI-Incidents ins
            Enterprise Risk Register. Idempotent via (catalogSource,
            catalogEntryId).
          </p>
        </div>
      </div>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
          <CardDescription>
            Minimum-Score filtert irrelevante Risiken aus. Empfehlung: 6 (medium
            x medium - hohe Impakte weiter unten haben Score &gt;= 9).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="min-score" className="text-xs">
              Minimum Score (1-25)
            </Label>
            <Input
              id="min-score"
              type="number"
              min="1"
              max="25"
              value={minScore}
              onChange={(e) =>
                setMinScore(
                  Math.min(25, Math.max(1, parseInt(e.target.value) || 1)),
                )
              }
              className="h-9"
            />
          </div>
          <Button
            onClick={() => void runSync(true)}
            disabled={loading}
            variant="outline"
          >
            {loading && preview === null ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4 mr-2" />
            )}
            Preview (Dry Run)
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || !preview || preview.eligibleForSync === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Sync ausfuehren
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Sync fehlgeschlagen</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && preview && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Bestaetigung Sync
            </CardTitle>
            <CardDescription>
              Dies erstellt oder aktualisiert{" "}
              <strong>{preview.eligibleForSync}</strong> Eintraege im ERM Risk
              Register.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => void runSync(false)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Ja, ausfuehren
            </Button>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Abbrechen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live result */}
      {liveResult && (
        <Card className="border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Sync abgeschlossen
            </CardTitle>
            <CardDescription>
              {liveResult.createdCount} neue Risiken erstellt,{" "}
              {liveResult.updatedCount} bestehende aktualisiert.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Kandidaten gesamt</p>
              <p className="text-2xl font-bold">{liveResult.totalCandidates}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Erstellt</p>
              <p className="text-2xl font-bold text-emerald-700">
                {liveResult.createdCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktualisiert</p>
              <p className="text-2xl font-bold text-sky-700">
                {liveResult.updatedCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gefiltert</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {liveResult.filteredByThreshold}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview (dry run) */}
      {preview && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Kandidaten gesamt
                </p>
                <p className="text-2xl font-bold">{preview.totalCandidates}</p>
              </CardContent>
            </Card>
            <Card
              className={
                preview.eligibleForSync > 0 ? "border-emerald-300" : ""
              }
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Zum Sync bereit
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  {preview.eligibleForSync}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <SkipForward className="h-3 w-3" />
                  Gefiltert
                </p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {preview.filteredByThreshold}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Min. Score</p>
                <p className="text-2xl font-bold">{minScore}</p>
              </CardContent>
            </Card>
          </div>

          {/* Eligible drafts */}
          {preview.drafts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Zum Sync bereit ({preview.drafts.length})</CardTitle>
                <CardDescription>
                  Diese Risiken werden im ERM Register erstellt oder
                  aktualisiert (idempotent via catalogSource + catalogEntryId).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-xs uppercase">
                          Score
                        </th>
                        <th className="text-left p-3 font-medium text-xs uppercase">
                          Quelle
                        </th>
                        <th className="text-left p-3 font-medium text-xs uppercase">
                          Titel
                        </th>
                        <th className="text-left p-3 font-medium text-xs uppercase">
                          Kategorie
                        </th>
                        <th className="text-right p-3 font-medium text-xs uppercase">
                          Likelihood x Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.drafts.map((d) => (
                        <tr
                          key={d.catalogEntryId}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="p-3">
                            {scoreBadge(d.riskScoreInherent)}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {SOURCE_LABELS[d.catalogSource] ?? d.catalogSource}
                          </td>
                          <td className="p-3">{d.title}</td>
                          <td className="p-3 text-xs">
                            <Badge variant="outline">{d.riskCategory}</Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {d.inherentLikelihood} x {d.inherentImpact}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skipped */}
          {preview.skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Gefiltert ({preview.skipped.length})
                </CardTitle>
                <CardDescription>
                  Diese Kandidaten wurden nicht aufgenommen (Score unter
                  Threshold).
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                <ul className="space-y-1 text-xs">
                  {preview.skipped.map((s) => (
                    <li
                      key={s.catalogEntryId}
                      className="flex justify-between border-b py-1.5"
                    >
                      <span className="font-mono text-muted-foreground">
                        {s.catalogEntryId}
                      </span>
                      <span className="text-muted-foreground">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {preview.eligibleForSync === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Keine Risiken erreichen den Minimum-Score von {minScore}.
                Threshold senken oder neue DPIAs/FRIAs/Incidents erfassen.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!preview && !liveResult && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">
              Klicke auf <strong>Preview</strong> um zu sehen welche DPIA-Risks,
              FRIA-Rechte und AI-Incidents ins ERM Register synchronisiert
              werden wuerden.
            </p>
            <Link
              href="/grc-composite"
              className="text-xs text-primary hover:underline inline-block mt-4"
            >
              &larr; Zurueck zum GRC Composite Dashboard
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
