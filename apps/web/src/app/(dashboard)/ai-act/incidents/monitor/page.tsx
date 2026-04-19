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

interface OverdueInfo {
  isNotified: boolean;
  isOverdue: boolean;
  hoursUntilDeadline: number | null;
  hoursOverdue: number | null;
  escalationLevel: EscalationLevel;
}

interface IncidentWithOverdue {
  id: string;
  aiSystemId: string | null;
  title: string;
  severity: string;
  isSerious: boolean;
  status: string;
  detectedAt: string;
  deadlineAt: string;
  authorityNotifiedAt: string | null;
  overdue: OverdueInfo;
}

interface MonitorResponse {
  incidents: IncidentWithOverdue[];
  summary: {
    total: number;
    criticalOverdue: number;
    overdue: number;
    approaching: number;
    ok: number;
  };
}

const ESCALATION_META: Record<
  EscalationLevel,
  { label: string; className: string; order: number; icon: typeof Clock }
> = {
  critical_overdue: {
    label: "CRITICAL OVERDUE",
    className: "bg-red-200 text-red-900 border-red-500",
    order: 0,
    icon: Siren,
  },
  overdue: {
    label: "OVERDUE",
    className: "bg-red-100 text-red-800 border-red-300",
    order: 1,
    icon: AlertTriangle,
  },
  approaching: {
    label: "APPROACHING",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    order: 2,
    icon: Clock,
  },
  none: {
    label: "OK",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    order: 3,
    icon: CheckCircle2,
  },
};

function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem === 0 ? `${days}d` : `${days}d ${rem}h`;
}

export default function IncidentsMonitorPage() {
  const [rows, setRows] = useState<IncidentWithOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai-act/incidents-monitor");
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as { data: MonitorResponse };
      const sorted = [...json.data.incidents].sort((a, b) => {
        const aOrder = ESCALATION_META[a.overdue.escalationLevel].order;
        const bOrder = ESCALATION_META[b.overdue.escalationLevel].order;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
      });
      setRows(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const bucket = {
    critical: rows.filter((r) => r.overdue.escalationLevel === "critical_overdue"),
    overdue: rows.filter((r) => r.overdue.escalationLevel === "overdue"),
    approaching: rows.filter((r) => r.overdue.escalationLevel === "approaching"),
    ok: rows.filter((r) => r.overdue.escalationLevel === "none"),
  };

  if (loading && rows.length === 0) {
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

  const renderRow = (r: IncidentWithOverdue) => {
    const ov = r.overdue;
    const meta = ESCALATION_META[ov.escalationLevel];
    const Icon = meta.icon;
    return (
      <Link
        key={r.id}
        href={`/ai-act/incidents/${r.id}`}
        className={`block border rounded-md p-3 hover:bg-muted/30 transition ${
          ov.escalationLevel === "critical_overdue"
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
            : ov.escalationLevel === "overdue"
              ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
              : ov.escalationLevel === "approaching"
                ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Icon
              className={`h-5 w-5 ${
                ov.escalationLevel === "critical_overdue"
                  ? "text-red-700"
                  : ov.escalationLevel === "overdue"
                    ? "text-red-600"
                    : ov.escalationLevel === "approaching"
                      ? "text-amber-600"
                      : "text-emerald-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>Erkannt: {new Date(r.detectedAt).toLocaleString("de-DE")}</span>
                  <span>Frist: {new Date(r.deadlineAt).toLocaleString("de-DE")}</span>
                  {r.isSerious && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs py-0">
                      serious
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={meta.className}>
                  {meta.label}
                </Badge>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {ov.isNotified ? (
                <span className="text-emerald-700">
                  ✓ Authority notified at{" "}
                  {r.authorityNotifiedAt
                    ? new Date(r.authorityNotifiedAt).toLocaleString("de-DE")
                    : "—"}
                </span>
              ) : ov.isOverdue ? (
                <span className="text-red-700 font-medium">
                  {formatHours(ov.hoursOverdue)} ueberfaellig
                </span>
              ) : (
                <span>{formatHours(ov.hoursUntilDeadline)} bis zur Frist</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ai-act/incidents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zur Incidents-Liste
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Incidents Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Art. 73 Frist-Ueberwachung fuer alle AI-Incidents. Escalation-Level basiert auf
            time-to-deadline (kritisch wenn &gt; 48h ueberfaellig).
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
              window.open("/api/v1/ai-act/incidents-monitor/pdf", "_blank")
            }
          >
            PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={bucket.critical.length > 0 ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Siren className="h-3.5 w-3.5" />
              Critical Overdue
            </p>
            <p className="text-3xl font-bold text-red-700">{bucket.critical.length}</p>
            <p className="text-xs text-muted-foreground mt-1">&gt; 48h ueberfaellig</p>
          </CardContent>
        </Card>
        <Card className={bucket.overdue.length > 0 ? "border-red-300" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue
            </p>
            <p className="text-3xl font-bold text-red-600">{bucket.overdue.length}</p>
            <p className="text-xs text-muted-foreground mt-1">0-48h ueberfaellig</p>
          </CardContent>
        </Card>
        <Card className={bucket.approaching.length > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Approaching
            </p>
            <p className="text-3xl font-bold text-amber-600">{bucket.approaching.length}</p>
            <p className="text-xs text-muted-foreground mt-1">&lt; 24h bis Frist</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              OK
            </p>
            <p className="text-3xl font-bold text-emerald-600">{bucket.ok.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              notified oder &gt; 24h verbleibend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical section */}
      {bucket.critical.length > 0 && (
        <Card className="border-red-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-700" />
              <CardTitle className="text-red-800">Critical Overdue -- Sofortmeldung!</CardTitle>
            </div>
            <CardDescription>
              Art. 73 Frist um mehr als 48h ueberschritten. Regulatorisches Risiko -- Board
              sofort informieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{bucket.critical.map(renderRow)}</CardContent>
        </Card>
      )}

      {/* Overdue */}
      {bucket.overdue.length > 0 && (
        <Card className="border-red-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Overdue (&lt; 48h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{bucket.overdue.map(renderRow)}</CardContent>
        </Card>
      )}

      {/* Approaching */}
      {bucket.approaching.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Approaching (&lt; 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{bucket.approaching.map(renderRow)}</CardContent>
        </Card>
      )}

      {/* OK */}
      {bucket.ok.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              OK ({bucket.ok.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{bucket.ok.map(renderRow)}</CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Keine AI-Incidents erfasst.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
