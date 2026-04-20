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
  FileWarning,
  Wrench,
  Gauge,
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

type EscalationLevel = "none" | "approaching" | "overdue" | "critical_overdue";

interface NcItem {
  kind: "nonconformity";
  id: string;
  code: string | null;
  title: string;
  severity: string;
  status: string;
  category: string | null;
  isoClause: string | null;
  identifiedAtIso: string;
  dueDate: string | null;
  assignedTo: string | null;
  frameworks?: string[];
  escalationLevel: EscalationLevel;
  daysUntilDeadline: number | null;
  daysOverdue: number | null;
  linkPath: string;
}

interface CaItem {
  kind: "corrective_action";
  id: string;
  title: string;
  status: string;
  actionType: string;
  dueDate: string | null;
  assignedTo: string | null;
  nonconformityId: string | null;
  frameworks?: string[];
  escalationLevel: EscalationLevel;
  daysUntilDeadline: number | null;
  daysOverdue: number | null;
  linkPath: string;
}

interface EffItem {
  kind: "effectiveness_review";
  id: string;
  title: string;
  reviewDueDate: string | null;
  escalationLevel: EscalationLevel;
  daysUntilDeadline: number | null;
  daysOverdue: number | null;
  linkPath: string;
}

interface MonitorResponse {
  summary: {
    ncTotal: number;
    ncOverdue: number;
    ncCriticalOverdue: number;
    caTotal: number;
    caOverdue: number;
    caCriticalOverdue: number;
    effectivenessReviewsDue: number;
    effectivenessReviewsOverdue: number;
  };
  nonconformities: NcItem[];
  correctiveActions: CaItem[];
  effectivenessReviews: EffItem[];
}

const ESCALATION_META: Record<
  EscalationLevel,
  { label: string; className: string; icon: typeof Clock }
> = {
  critical_overdue: {
    label: "CRITICAL OVERDUE",
    className: "bg-red-200 text-red-900 border-red-500",
    icon: Siren,
  },
  overdue: {
    label: "OVERDUE",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: AlertTriangle,
  },
  approaching: {
    label: "APPROACHING",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    icon: Clock,
  },
  none: {
    label: "OK",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle2,
  },
};

function formatDays(d: number | null): string {
  if (d === null) return "—";
  return `${d}d`;
}

function severityPill(sev: string) {
  const className =
    sev === "major"
      ? "bg-red-100 text-red-800 border-red-300"
      : sev === "minor"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-slate-100 text-slate-700 border-slate-300";
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {sev}
    </Badge>
  );
}

export default function IsmsCapMonitorPage() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/isms/cap-monitor");
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

  const renderNcRow = (n: NcItem) => {
    const meta = ESCALATION_META[n.escalationLevel];
    const Icon = meta.icon;
    return (
      <Link
        key={n.id}
        href={n.linkPath}
        className={`block border rounded-md p-3 hover:bg-muted/30 transition ${
          n.escalationLevel === "critical_overdue"
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
            : n.escalationLevel === "overdue"
              ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
              : n.escalationLevel === "approaching"
                ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Icon
              className={`h-5 w-5 ${
                n.escalationLevel === "critical_overdue"
                  ? "text-red-700"
                  : n.escalationLevel === "overdue"
                    ? "text-red-600"
                    : n.escalationLevel === "approaching"
                      ? "text-amber-600"
                      : "text-emerald-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {n.code && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {n.code}
                    </span>
                  )}
                  <p className="font-medium truncate">{n.title}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  {severityPill(n.severity)}
                  <Badge variant="outline" className="text-xs py-0">
                    {n.status}
                  </Badge>
                  {n.isoClause && (
                    <Badge variant="outline" className="text-xs py-0">
                      ISO {n.isoClause}
                    </Badge>
                  )}
                  {n.dueDate && <span>Faellig: {n.dueDate}</span>}
                  {n.frameworks?.map((fw) => (
                    <Badge
                      key={fw}
                      variant="outline"
                      className="bg-sky-50 text-sky-800 border-sky-200 text-xs py-0"
                    >
                      {fw}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className={meta.className}>
                {meta.label}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {n.escalationLevel === "overdue" ||
              n.escalationLevel === "critical_overdue" ? (
                <span className="text-red-700 font-medium">
                  {formatDays(n.daysOverdue)} ueberfaellig
                </span>
              ) : n.escalationLevel === "approaching" ? (
                <span className="text-amber-700">
                  {formatDays(n.daysUntilDeadline)} bis zur Frist
                </span>
              ) : n.dueDate ? (
                <span>{formatDays(n.daysUntilDeadline)} bis zur Frist</span>
              ) : (
                <span>Keine Frist gesetzt</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const renderCaRow = (c: CaItem) => {
    const meta = ESCALATION_META[c.escalationLevel];
    const Icon = meta.icon;
    return (
      <Link
        key={c.id}
        href={c.linkPath}
        className={`block border rounded-md p-3 hover:bg-muted/30 transition ${
          c.escalationLevel === "critical_overdue"
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
            : c.escalationLevel === "overdue"
              ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
              : c.escalationLevel === "approaching"
                ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs py-0">
                    {c.actionType}
                  </Badge>
                  <Badge variant="outline" className="text-xs py-0">
                    {c.status}
                  </Badge>
                  {c.dueDate && <span>Faellig: {c.dueDate}</span>}
                </div>
              </div>
              <Badge variant="outline" className={meta.className}>
                {meta.label}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {c.escalationLevel === "overdue" ||
              c.escalationLevel === "critical_overdue" ? (
                <span className="text-red-700 font-medium">
                  {formatDays(c.daysOverdue)} ueberfaellig
                </span>
              ) : c.escalationLevel === "approaching" ? (
                <span className="text-amber-700">
                  {formatDays(c.daysUntilDeadline)} bis zur Frist
                </span>
              ) : c.dueDate ? (
                <span>{formatDays(c.daysUntilDeadline)} bis zur Frist</span>
              ) : (
                <span>Keine Frist gesetzt</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/isms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zu ISMS
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            ISMS CAP Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            ISO 27001 Kap. 10 Corrective-Action-Program. Nonconformities,
            Corrective-Actions und Effectiveness-Reviews mit Fristen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button
            size="sm"
            onClick={() =>
              window.open("/api/v1/isms/cap-monitor/pdf", "_blank")
            }
          >
            PDF
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={
            s.ncCriticalOverdue > 0
              ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
              : ""
          }
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileWarning className="h-3.5 w-3.5" />
              Offene Nonconformities
            </p>
            <p className="text-3xl font-bold">{s.ncTotal}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s.ncOverdue > 0 ? (
                <span className="text-red-700">{s.ncOverdue} ueberfaellig</span>
              ) : (
                "alle innerhalb Frist"
              )}
            </p>
          </CardContent>
        </Card>
        <Card
          className={
            s.caCriticalOverdue > 0
              ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
              : ""
          }
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              Offene Corrective-Actions
            </p>
            <p className="text-3xl font-bold">{s.caTotal}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s.caOverdue > 0 ? (
                <span className="text-red-700">{s.caOverdue} ueberfaellig</span>
              ) : (
                "alle innerhalb Frist"
              )}
            </p>
          </CardContent>
        </Card>
        <Card
          className={s.effectivenessReviewsOverdue > 0 ? "border-red-300" : ""}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              Effectiveness-Reviews
            </p>
            <p className="text-3xl font-bold">{s.effectivenessReviewsDue}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s.effectivenessReviewsOverdue > 0 ? (
                <span className="text-red-700">
                  {s.effectivenessReviewsOverdue} ueberfaellig
                </span>
              ) : (
                "alle aktuell"
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Siren className="h-3.5 w-3.5" />
              Critical Overdue gesamt
            </p>
            <p className="text-3xl font-bold text-red-700">
              {s.ncCriticalOverdue + s.caCriticalOverdue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              &gt; 30d ueberfaellig
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Nonconformities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileWarning className="h-5 w-5 text-primary" />
            Nonconformities ({data.nonconformities.length})
          </CardTitle>
          <CardDescription>
            Offene Nichtkonformitaeten aus Audits, Management-Reviews, Incidents
            oder externen Pruefungen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.nonconformities.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Keine offenen Nonconformities.
            </div>
          ) : (
            data.nonconformities.map(renderNcRow)
          )}
        </CardContent>
      </Card>

      {/* Corrective Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-primary" />
            Corrective Actions ({data.correctiveActions.length})
          </CardTitle>
          <CardDescription>
            Offene CAPAs aus Nonconformities. Status &ne; closed und
            completed_at = null.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.correctiveActions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Keine offenen Corrective-Actions.
            </div>
          ) : (
            data.correctiveActions.map(renderCaRow)
          )}
        </CardContent>
      </Card>

      {/* Effectiveness Reviews */}
      {data.effectivenessReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" />
              Effectiveness Reviews ({data.effectivenessReviews.length})
            </CardTitle>
            <CardDescription>
              CAPAs die abgeschlossen sind aber noch keine
              Effectiveness-Bewertung haben.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.effectivenessReviews.map((e) => {
              const meta = ESCALATION_META[e.escalationLevel];
              return (
                <Link
                  key={e.id}
                  href={e.linkPath}
                  className="block border rounded-md p-3 hover:bg-muted/30 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.title}</p>
                      {e.reviewDueDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Review-Frist: {e.reviewDueDate}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
