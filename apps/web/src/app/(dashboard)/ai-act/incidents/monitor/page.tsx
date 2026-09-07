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
import { ErrorRetry } from "@/components/ui/error-retry";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Diese Seite war zur Haelfte
 * englisch und zur Haelfte deutsch — in DERSELBEN Zeile: "Art. 73
 * Frist-Ueberwachung fuer alle AI-Incidents" neben "CRITICAL OVERDUE" und
 * "✓ Authority notified at". Fuer beide Sprachgruppen war sie falsch.
 *
 * `ESCALATION_META` und `formatHours` stehen ausserhalb der Komponente und
 * koennen keinen Hook lesen. `formatHours` nimmt die Uebersetzungsfunktion
 * jetzt als Parameter — dasselbe Vorgehen wie bei den drei Hilfsfunktionen
 * aus Welle 5a, Schnitt 6. Die Eskalationsstufe wird ueber ein Template
 * aufgeloest (`t(`monitor.level.${…}`)`) und nicht ueber einen
 * `labelKey`-Eintrag in der Tabelle: der Detektor in
 * `scripts/audit-i18n-usage.mjs` kennt die Template-Form und wuerde die vier
 * Stufen sonst als „nie erreicht" zaehlen.
 */
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
  frameworks?: string[];
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
  { className: string; order: number; icon: typeof Clock }
> = {
  critical_overdue: {
    className: "bg-red-200 text-red-900 border-red-500",
    order: 0,
    icon: Siren,
  },
  overdue: {
    className: "bg-red-100 text-red-800 border-red-300",
    order: 1,
    icon: AlertTriangle,
  },
  approaching: {
    className: "bg-amber-100 text-amber-800 border-amber-300",
    order: 2,
    icon: Clock,
  },
  none: {
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    order: 3,
    icon: CheckCircle2,
  },
};

function formatHours(
  h: number | null,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (h === null) return "—";
  if (h < 24) return t("monitor.hoursShort", { hours: h });
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem === 0
    ? t("monitor.daysShort", { days })
    : t("monitor.daysHoursShort", { days, hours: rem });
}

export default function IncidentsMonitorPage() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDateTime } = useDateFormat();
  const [rows, setRows] = useState<IncidentWithOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai-act/incidents-monitor");
      if (!res.ok)
        throw new Error(tCommon("common.httpError", { status: res.status }));
      const json = (await res.json()) as { data: MonitorResponse };
      const sorted = [...json.data.incidents].sort((a, b) => {
        const aOrder = ESCALATION_META[a.overdue.escalationLevel].order;
        const bOrder = ESCALATION_META[b.overdue.escalationLevel].order;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (
          new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
        );
      });
      setRows(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("common.error"));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const bucket = {
    critical: rows.filter(
      (r) => r.overdue.escalationLevel === "critical_overdue",
    ),
    overdue: rows.filter((r) => r.overdue.escalationLevel === "overdue"),
    approaching: rows.filter(
      (r) => r.overdue.escalationLevel === "approaching",
    ),
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
      <ErrorRetry
        title={t("monitor.loadError")}
        message={error}
        onRetry={fetchData}
      />
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span>
                    {t("monitor.detectedAt", {
                      value: formatDateTime(r.detectedAt),
                    })}
                  </span>
                  <span>
                    {t("monitor.deadlineAt", {
                      value: formatDateTime(r.deadlineAt),
                    })}
                  </span>
                  {r.isSerious && (
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200 text-xs py-0"
                    >
                      {t("monitor.serious")}
                    </Badge>
                  )}
                  {r.frameworks?.map((fw) => (
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
                  {t(`monitor.level.${ov.escalationLevel}`)}
                </Badge>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {ov.isNotified ? (
                <span className="text-emerald-700">
                  {t("monitor.authorityNotified", {
                    value: r.authorityNotifiedAt
                      ? formatDateTime(r.authorityNotifiedAt)
                      : "—",
                  })}
                </span>
              ) : ov.isOverdue ? (
                <span className="text-red-700 font-medium">
                  {t("monitor.overdueBy", {
                    value: formatHours(ov.hoursOverdue, t),
                  })}
                </span>
              ) : (
                <span>
                  {t("monitor.remainingUntilDeadline", {
                    value: formatHours(ov.hoursUntilDeadline, t),
                  })}
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ai-act/incidents"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("monitor.backToIncidents")}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("monitor.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("monitor.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            {tCommon("actions.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              window.open("/api/v1/ai-act/incidents-monitor/pdf", "_blank")
            }
          >
            {t("monitor.pdf")}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={
            bucket.critical.length > 0
              ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
              : ""
          }
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Siren className="h-3.5 w-3.5" />
              {t("monitor.kpi.criticalOverdue")}
            </p>
            <p className="text-3xl font-bold text-red-700">
              {bucket.critical.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("monitor.kpi.criticalOverdueHint")}
            </p>
          </CardContent>
        </Card>
        <Card className={bucket.overdue.length > 0 ? "border-red-300" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("monitor.kpi.overdue")}
            </p>
            <p className="text-3xl font-bold text-red-600">
              {bucket.overdue.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("monitor.kpi.overdueHint")}
            </p>
          </CardContent>
        </Card>
        <Card
          className={bucket.approaching.length > 0 ? "border-amber-300" : ""}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t("monitor.kpi.approaching")}
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {bucket.approaching.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("monitor.kpi.approachingHint")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("monitor.kpi.ok")}
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {bucket.ok.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("monitor.kpi.okHint")}
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
              <CardTitle className="text-red-800">
                {t("monitor.criticalSectionTitle")}
              </CardTitle>
            </div>
            <CardDescription>
              {t("monitor.criticalSectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bucket.critical.map(renderRow)}
          </CardContent>
        </Card>
      )}

      {/* Overdue */}
      {bucket.overdue.length > 0 && (
        <Card className="border-red-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              {t("monitor.overdueSectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bucket.overdue.map(renderRow)}
          </CardContent>
        </Card>
      )}

      {/* Approaching */}
      {bucket.approaching.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              {t("monitor.approachingSectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bucket.approaching.map(renderRow)}
          </CardContent>
        </Card>
      )}

      {/* OK */}
      {bucket.ok.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t("monitor.okSectionTitle", { count: bucket.ok.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bucket.ok.map(renderRow)}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("monitor.empty")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
