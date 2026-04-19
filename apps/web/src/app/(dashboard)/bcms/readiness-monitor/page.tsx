"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Siren,
  RefreshCcw,
  ArrowLeft,
  ShieldAlert,
  FileText,
  FlaskConical,
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

interface DoraState {
  earlyWarningAtIso: string;
  intermediateAtIso: string;
  finalAtIso: string;
  earlyWarningOverdue: boolean;
  intermediateOverdue: boolean;
  finalOverdue: boolean;
  nextDeadlineLabel: "early_warning" | "intermediate" | "final" | "none";
  nextDeadlineAtIso: string | null;
  hoursUntilNext: number | null;
}

interface ActiveCrisis {
  id: string;
  name: string;
  severity: string;
  activatedAtIso: string;
  dora: DoraState;
}

interface BcpIssue {
  id: string;
  title: string;
  status: string;
  nextReviewDate: string | null;
  lastTestedDate: string | null;
  reviewOverdueDays: number | null;
  testAgeDays: number | null;
  reviewOverdue: boolean;
  untested: boolean;
  testStale: boolean;
}

interface MonitorResponse {
  summary: {
    activeCrisesCount: number;
    crisesWithOverdueDora: number;
    bcpTotal: number;
    bcpWithIssues: number;
    bcpReviewOverdue: number;
    bcpUntested: number;
    bcpTestStale: number;
    exerciseCoverageYtd: number;
    exerciseIsoGap: boolean;
    overallReady: boolean;
  };
  activeCrises: ActiveCrisis[];
  bcpIssues: BcpIssue[];
  exerciseCoverageYtd: number;
}

function doraBadge(crisis: ActiveCrisis) {
  const { dora } = crisis;
  if (dora.finalOverdue) {
    return (
      <Badge variant="outline" className="bg-red-200 text-red-900 border-red-500">
        <Siren className="h-3 w-3 mr-1" />
        FINAL OVERDUE (1-Monat-Report)
      </Badge>
    );
  }
  if (dora.intermediateOverdue) {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
        <AlertTriangle className="h-3 w-3 mr-1" />
        72H OVERDUE
      </Badge>
    );
  }
  if (dora.earlyWarningOverdue) {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
        <Clock className="h-3 w-3 mr-1" />
        4H PASSED
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      ON TRACK
    </Badge>
  );
}

export default function BcmsReadinessMonitorPage() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/bcms/readiness-monitor");
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as { data: MonitorResponse };
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">Monitor konnte nicht geladen werden</p>
            </div>
            <p className="text-sm text-red-700 mt-2">{error}</p>
            <Button onClick={fetchData} className="mt-4" variant="outline">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/bcms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zu BCMS
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">BCMS Readiness Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Aktive Krisen mit DORA 4h/72h/1-Monat-Timer + BCP-Freshness + ISO 22301 Kap. 8.5
            Exercise-Coverage.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Overall state */}
      <Card
        className={
          s.overallReady
            ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10"
            : "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {s.overallReady ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              Overall BCMS Readiness
            </CardTitle>
            {s.overallReady ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                READY
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                LUECKEN
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Aktive Krisen</p>
              <p className={`text-2xl font-bold ${s.activeCrisesCount > 0 ? "text-red-700" : ""}`}>
                {s.activeCrisesCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">BCPs mit Luecken</p>
              <p className={`text-2xl font-bold ${s.bcpWithIssues > 0 ? "text-amber-700" : ""}`}>
                {s.bcpWithIssues}/{s.bcpTotal}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Uebungen YTD</p>
              <p className={`text-2xl font-bold ${s.exerciseIsoGap ? "text-red-700" : ""}`}>
                {s.exerciseCoverageYtd}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">DORA Overdue</p>
              <p className={`text-2xl font-bold ${s.crisesWithOverdueDora > 0 ? "text-red-700" : ""}`}>
                {s.crisesWithOverdueDora}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Crises */}
      {data.activeCrises.length > 0 ? (
        <Card className="border-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-700" />
              <CardTitle className="text-red-800">
                Aktive Krisen ({data.activeCrises.length})
              </CardTitle>
            </div>
            <CardDescription>
              DORA-Timer: 4h Early-Warning → 72h Intermediate → 1-Monat Final-Report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeCrises.map((c) => (
              <div key={c.id} className="border rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs">
                        {c.severity}
                      </Badge>
                      <span>
                        Aktiviert: {new Date(c.activatedAtIso).toLocaleString("de-DE")}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">{doraBadge(c)}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div
                    className={
                      c.dora.earlyWarningOverdue
                        ? "text-red-700"
                        : "text-amber-700"
                    }
                  >
                    <p className="text-muted-foreground mb-0.5">4h Early Warning</p>
                    <p className="font-medium">
                      {new Date(c.dora.earlyWarningAtIso).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <div className={c.dora.intermediateOverdue ? "text-red-700" : ""}>
                    <p className="text-muted-foreground mb-0.5">72h Intermediate</p>
                    <p className="font-medium">
                      {new Date(c.dora.intermediateAtIso).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <div className={c.dora.finalOverdue ? "text-red-700" : ""}>
                    <p className="text-muted-foreground mb-0.5">1-Monat Final</p>
                    <p className="font-medium">
                      {new Date(c.dora.finalAtIso).toLocaleString("de-DE")}
                    </p>
                  </div>
                </div>
                {c.dora.nextDeadlineLabel !== "none" && c.dora.hoursUntilNext !== null && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Naechste Deadline ({c.dora.nextDeadlineLabel}): in {c.dora.hoursUntilNext}h
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Keine aktiven Krisen
            </CardTitle>
            <CardDescription>
              Alle Crisis-Scenarios im Standby. DORA-Timer werden aktiv sobald ein
              Szenario auf "activated" transitioniert.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Exercise Coverage */}
      <Card
        className={s.exerciseIsoGap ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : ""}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">ISO 22301 Kap. 8.5 Exercise-Coverage</CardTitle>
                <CardDescription>
                  Mindestens eine Uebung pro Kalenderjahr. Alternativ auch Live-Exercise
                  waehrend tatsaechlicher Krise.
                </CardDescription>
              </div>
            </div>
            {s.exerciseIsoGap ? (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                LUECKE
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                ERFUELLT
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="font-bold text-2xl mr-2">{data.exerciseCoverageYtd}</span>
            abgeschlossene Uebung{data.exerciseCoverageYtd === 1 ? "" : "en"} in diesem Kalenderjahr.
          </p>
          {s.exerciseIsoGap && (
            <p className="text-xs text-red-700 mt-2">
              ISO 22301 Kap. 8.5 Verstoss — Uebung einplanen bevor Kalenderjahr endet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* BCP Issues */}
      {data.bcpIssues.length > 0 ? (
        <Card className="border-amber-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              <CardTitle>BCPs mit Freshness-Luecken ({data.bcpIssues.length})</CardTitle>
            </div>
            <CardDescription>
              Review-Date ueberfaellig, nicht getestet, oder letzter Test &gt; 1 Jahr.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.bcpIssues.map((b) => (
              <Link
                key={b.id}
                href={`/bcms/plans/${b.id}`}
                className="block border rounded p-3 hover:bg-muted/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs py-0">
                        {b.status}
                      </Badge>
                      {b.nextReviewDate && (
                        <span>Naechste Review: {b.nextReviewDate}</span>
                      )}
                      {b.lastTestedDate && (
                        <span>Letzter Test: {b.lastTestedDate}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    {b.reviewOverdue && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                        Review {b.reviewOverdueDays}d ueberfaellig
                      </Badge>
                    )}
                    {b.untested && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                        Nie getestet
                      </Badge>
                    )}
                    {b.testStale && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                        Test {b.testAgeDays}d alt
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Alle BCPs aktuell ({s.bcpTotal})
            </CardTitle>
            <CardDescription>
              Keine Reviews ueberfaellig, alle published/approved BCPs getestet innerhalb
              der letzten 12 Monate.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
