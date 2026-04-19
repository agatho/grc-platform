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
  FileText,
  ShieldAlert,
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

interface MonitorItem {
  kind: "dsr" | "breach";
  id: string;
  title: string;
  status: string;
  severity?: string;
  createdAtIso: string;
  deadlineIso: string | null;
  closedAtIso: string | null;
  frameworks?: string[];
  escalationLevel: EscalationLevel;
  hoursUntilDeadline: number | null;
  hoursOverdue: number | null;
  isClosed: boolean;
  linkPath: string;
}

interface MonitorResponse {
  items: MonitorItem[];
  summary: {
    total: number;
    criticalOverdue: number;
    overdue: number;
    approaching: number;
    ok: number;
    byKind: {
      dsr: { total: number; overdue: number };
      breach: { total: number; overdue: number };
    };
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

export default function DpmsDeadlineMonitorPage() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "dsr" | "breach">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/dpms/deadline-monitor");
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

  const filteredItems = data.items
    .filter((i) => kindFilter === "all" || i.kind === kindFilter)
    .sort((a, b) => {
      const aOrder = ESCALATION_META[a.escalationLevel].order;
      const bOrder = ESCALATION_META[b.escalationLevel].order;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime();
    });

  const bucket = {
    critical: filteredItems.filter((i) => i.escalationLevel === "critical_overdue"),
    overdue: filteredItems.filter((i) => i.escalationLevel === "overdue"),
    approaching: filteredItems.filter((i) => i.escalationLevel === "approaching"),
    ok: filteredItems.filter((i) => i.escalationLevel === "none"),
  };

  const renderRow = (i: MonitorItem) => {
    const meta = ESCALATION_META[i.escalationLevel];
    const Icon = meta.icon;
    const KindIcon = i.kind === "dsr" ? FileText : ShieldAlert;
    const deadlineLabel =
      i.kind === "dsr" ? "Response-Deadline" : "Art. 33 72h Frist";
    return (
      <Link
        key={`${i.kind}-${i.id}`}
        href={i.linkPath}
        className={`block border rounded-md p-3 hover:bg-muted/30 transition ${
          i.escalationLevel === "critical_overdue"
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
            : i.escalationLevel === "overdue"
              ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
              : i.escalationLevel === "approaching"
                ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Icon
              className={`h-5 w-5 ${
                i.escalationLevel === "critical_overdue"
                  ? "text-red-700"
                  : i.escalationLevel === "overdue"
                    ? "text-red-600"
                    : i.escalationLevel === "approaching"
                      ? "text-amber-600"
                      : "text-emerald-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <KindIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-medium truncate">{i.title}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span>Erfasst: {new Date(i.createdAtIso).toLocaleString("de-DE")}</span>
                  {i.deadlineIso && (
                    <span>
                      {deadlineLabel}: {new Date(i.deadlineIso).toLocaleString("de-DE")}
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs py-0">
                    {i.status}
                  </Badge>
                  {i.severity && (
                    <Badge variant="outline" className="text-xs py-0">
                      {i.severity}
                    </Badge>
                  )}
                  {i.frameworks?.map((fw) => (
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
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={meta.className}>
                  {meta.label}
                </Badge>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {i.isClosed ? (
                <span className="text-emerald-700">
                  ✓ Geschlossen{" "}
                  {i.closedAtIso ? `am ${new Date(i.closedAtIso).toLocaleString("de-DE")}` : ""}
                </span>
              ) : i.escalationLevel === "overdue" ||
                i.escalationLevel === "critical_overdue" ? (
                <span className="text-red-700 font-medium">
                  {formatHours(i.hoursOverdue)} ueberfaellig
                </span>
              ) : i.escalationLevel === "approaching" ? (
                <span className="text-amber-700">
                  {formatHours(i.hoursUntilDeadline)} bis zur Frist
                </span>
              ) : (
                <span>
                  {i.deadlineIso
                    ? `${formatHours(i.hoursUntilDeadline)} bis zur Frist`
                    : "Keine Frist aktiv"}
                </span>
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
            href="/dpms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zu DPMS
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">DPMS Deadline Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Vereinheitlichte Art. 12(3) DSR-Response-Fristen und Art. 33 Breach-Notification
            (72h). Escalation kritisch wenn &gt; 48h ueberfaellig.
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
              window.open("/api/v1/dpms/deadline-monitor/pdf", "_blank")
            }
          >
            PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={
            data.summary.criticalOverdue > 0
              ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
              : ""
          }
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Siren className="h-3.5 w-3.5" />
              Critical Overdue
            </p>
            <p className="text-3xl font-bold text-red-700">{data.summary.criticalOverdue}</p>
            <p className="text-xs text-muted-foreground mt-1">&gt; 48h ueberfaellig</p>
          </CardContent>
        </Card>
        <Card className={data.summary.overdue > 0 ? "border-red-300" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue
            </p>
            <p className="text-3xl font-bold text-red-600">{data.summary.overdue}</p>
            <p className="text-xs text-muted-foreground mt-1">0-48h ueberfaellig</p>
          </CardContent>
        </Card>
        <Card className={data.summary.approaching > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Approaching
            </p>
            <p className="text-3xl font-bold text-amber-600">{data.summary.approaching}</p>
            <p className="text-xs text-muted-foreground mt-1">&lt; 24h bis Frist</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              OK
            </p>
            <p className="text-3xl font-bold text-emerald-600">{data.summary.ok}</p>
            <p className="text-xs text-muted-foreground mt-1">
              geschlossen oder &gt; 24h verbleibend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kind filter */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={kindFilter === "all" ? "default" : "outline"}
              onClick={() => setKindFilter("all")}
            >
              Alle ({data.items.length})
            </Button>
            <Button
              size="sm"
              variant={kindFilter === "dsr" ? "default" : "outline"}
              onClick={() => setKindFilter("dsr")}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              DSRs ({data.summary.byKind.dsr.total})
              {data.summary.byKind.dsr.overdue > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-200 text-red-900">
                  {data.summary.byKind.dsr.overdue}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              variant={kindFilter === "breach" ? "default" : "outline"}
              onClick={() => setKindFilter("breach")}
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1" />
              Breaches ({data.summary.byKind.breach.total})
              {data.summary.byKind.breach.overdue > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-200 text-red-900">
                  {data.summary.byKind.breach.overdue}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Critical section */}
      {bucket.critical.length > 0 && (
        <Card className="border-red-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-700" />
              <CardTitle className="text-red-800">Critical Overdue -- Sofortmeldung!</CardTitle>
            </div>
            <CardDescription>
              GDPR-Frist um mehr als 48h ueberschritten. DPO + Geschaeftsfuehrung unverzueglich
              einbinden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">{bucket.critical.map(renderRow)}</CardContent>
        </Card>
      )}

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

      {filteredItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Keine offenen DSRs oder Breaches im gewaehlten Filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
