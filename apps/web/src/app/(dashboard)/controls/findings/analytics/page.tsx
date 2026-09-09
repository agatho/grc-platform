"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  BarChart3,
  Clock,
  AlertTriangle,
  Settings,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TtrItem {
  severity: string;
  avgDays: number;
  medianDays: number;
  count: number;
  slaDays: number | null;
}

interface SlaBySeverity {
  severity: string;
  total: number;
  withinSla: number;
  breached: number;
  complianceRate: number;
  slaDays: number;
}

interface SlaData {
  overall: { total: number; withinSla: number; complianceRate: number };
  bySeverity: SlaBySeverity[];
}

interface AgingData {
  totals: Record<string, number>;
  bySeverity: Record<string, Record<string, number>>;
  bucketLabels: Record<string, string>;
}

interface SlaConfigItem {
  id: string;
  orgId: string;
  severity: string;
  slaDays: number;
}

interface AnalyticsData {
  ttr: TtrItem[];
  sla: SlaData | null;
  aging: AgingData | null;
  slaConfig: SlaConfigItem[];
}

type SlaConfigDraft = { severity: string; slaDays: number };

// Stable empty defaults for the query data while it is still pending.
const NO_TTR: TtrItem[] = [];
const NO_SLA_CONFIG: SlaConfigItem[] = [];

// Defaults for the SLA form when the org has not configured any yet.
const DEFAULT_SLA_CONFIG: SlaConfigDraft[] = [
  { severity: "significant_nonconformity", slaDays: 14 },
  { severity: "insignificant_nonconformity", slaDays: 30 },
  { severity: "improvement_requirement", slaDays: 60 },
  { severity: "recommendation", slaDays: 90 },
  { severity: "observation", slaDays: 180 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    significant_nonconformity: "bg-red-100 text-red-800",
    insignificant_nonconformity: "bg-orange-100 text-orange-800",
    improvement_requirement: "bg-yellow-100 text-yellow-800",
    recommendation: "bg-blue-100 text-blue-800",
    observation: "bg-gray-100 text-gray-800",
  };
  return colors[severity] ?? "bg-gray-100 text-gray-800";
}

const BUCKET_COLORS: Record<string, string> = {
  lt30: "bg-green-500",
  "30to60": "bg-yellow-400",
  "60to90": "bg-orange-400",
  gt90: "bg-red-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FindingAnalyticsPage() {
  const t = useTranslations("intelligence");

  const [showConfig, setShowConfig] = useState(false);

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `dashboard/page.tsx`). Die vier Abrufe wurden immer zusammen
  // geholt und zusammen gezeigt, darum eine Abfrage mit einem Objekt. Wie
  // vorher werden die Antworten ohne `ok`-Prüfung gelesen; ein Fehler lässt
  // die Karten leer (kein eigener Fehlerzustand, so war es auch).
  const {
    data,
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<AnalyticsData>({
    queryKey: ["findings", "analytics", "overview"],
    queryFn: async () => {
      const [ttrRes, slaRes, agingRes, configRes] = await Promise.all([
        fetch("/api/v1/findings/analytics/ttr"),
        fetch("/api/v1/findings/analytics/sla"),
        fetch("/api/v1/findings/analytics/aging"),
        fetch("/api/v1/ics/finding-sla"),
      ]);

      const ttrJson = await ttrRes.json();
      const slaJson = await slaRes.json();
      const agingJson = await agingRes.json();
      const configJson = await configRes.json();

      return {
        ttr: (ttrJson.data ?? []) as TtrItem[],
        sla: (slaJson.data ?? null) as SlaData | null,
        aging: (agingJson.data ?? null) as AgingData | null,
        slaConfig: (configJson.data ?? []) as SlaConfigItem[],
      };
    },
  });
  const ttrData = data?.ttr ?? NO_TTR;
  const slaData = data?.sla ?? null;
  const agingData = data?.aging ?? null;
  const slaConfig = data?.slaConfig ?? NO_SLA_CONFIG;

  const fetchAll = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // [OP-245 · Gestalt E] Die SLA-Tabelle ist ein Formular, dessen Saat der
  // Server setzt (Konfiguration, sonst Vorgaben) und das der Nutzer danach
  // bearbeitet. Sie lebt in einem eigenen Bauteil (`SlaConfigEditor`), das
  // beim Öffnen der Karte mit dieser Saat EINGEHÄNGT wird — kein
  // spiegelnder Effekt, und ein Hintergrundabruf überschreibt keine
  // Eingaben mehr (Muster aus Welle 7b, `processes/[id]/ropa`).
  const slaSeed: SlaConfigDraft[] =
    slaConfig.length > 0
      ? slaConfig.map((c) => ({ severity: c.severity, slaDays: c.slaDays }))
      : DEFAULT_SLA_CONFIG;

  const maxTtr = Math.max(...ttrData.map((d) => d.avgDays), 1);
  const totalAging = agingData
    ? Object.values(agingData.totals).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <ModuleGate moduleKey="ics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {t("findingAnalytics.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("findingAnalytics.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {t("findingAnalytics.slaConfig")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAll}
              disabled={isFetching}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
              />
              {t("findingAnalytics.refresh")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* TTR Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t("findingAnalytics.ttrTitle")}
                </CardTitle>
                <CardDescription>
                  {t("findingAnalytics.ttrDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ttrData.map((item) => (
                    <div key={item.severity} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <Badge className={severityBadge(item.severity)}>
                          {item.severity.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-muted-foreground">
                          {item.avgDays}d avg / {item.medianDays}d med (n=
                          {item.count})
                        </span>
                      </div>
                      <div className="relative h-6 bg-muted rounded">
                        <div
                          className="absolute h-full bg-primary rounded transition-all"
                          style={{ width: `${(item.avgDays / maxTtr) * 100}%` }}
                        />
                        {item.slaDays && (
                          <div
                            className="absolute h-full w-0.5 bg-destructive"
                            style={{
                              left: `${Math.min(100, (item.slaDays / maxTtr) * 100)}%`,
                            }}
                            title={`SLA: ${item.slaDays}d`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {ttrData.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("findingAnalytics.noData")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SLA Compliance Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t("findingAnalytics.slaTitle")}
                </CardTitle>
                <CardDescription>
                  {t("findingAnalytics.slaDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {slaData && (
                  <div className="space-y-4">
                    {/* Overall compliance */}
                    <div className="flex items-center justify-center">
                      <div className="relative w-32 h-32">
                        <svg
                          viewBox="0 0 100 100"
                          className="w-full h-full -rotate-90"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="currentColor"
                            className="text-muted"
                            strokeWidth="12"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="currentColor"
                            className={
                              slaData.overall.complianceRate >= 80
                                ? "text-green-500"
                                : slaData.overall.complianceRate >= 50
                                  ? "text-yellow-500"
                                  : "text-red-500"
                            }
                            strokeWidth="12"
                            strokeDasharray={`${slaData.overall.complianceRate * 2.51} 251`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">
                            {slaData.overall.complianceRate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Per-severity breakdown */}
                    <div className="space-y-2">
                      {slaData.bySeverity.map((s) => (
                        <div
                          key={s.severity}
                          className="flex items-center justify-between text-sm"
                        >
                          <Badge className={severityBadge(s.severity)}>
                            {s.severity.replace(/_/g, " ")}
                          </Badge>
                          <span>
                            {s.complianceRate}% ({s.withinSla}/{s.total})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aging Distribution */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("findingAnalytics.agingTitle")}</CardTitle>
                <CardDescription>
                  {t("findingAnalytics.agingDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agingData && (
                  <div className="space-y-4">
                    {/* Stacked bar for totals */}
                    <div className="flex h-10 rounded overflow-hidden">
                      {Object.entries(agingData.totals).map(([bucket, cnt]) => {
                        const pct =
                          totalAging > 0 ? (cnt / totalAging) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={bucket}
                            className={`flex items-center justify-center text-xs text-white font-medium ${BUCKET_COLORS[bucket] ?? "bg-gray-400"}`}
                            style={{ width: `${pct}%` }}
                            title={`${agingData.bucketLabels[bucket]}: ${cnt}`}
                          >
                            {cnt > 0 ? cnt : ""}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex gap-4 text-xs flex-wrap">
                      {Object.entries(agingData.bucketLabels).map(
                        ([key, label]) => (
                          <span key={key} className="flex items-center gap-1">
                            <span
                              className={`w-3 h-3 rounded ${BUCKET_COLORS[key] ?? "bg-gray-400"}`}
                            />
                            {label}: {agingData.totals[key] ?? 0}
                          </span>
                        ),
                      )}
                    </div>

                    {/* Per-severity breakdown */}
                    <div className="space-y-2">
                      {Object.entries(agingData.bySeverity).map(
                        ([severity, buckets]) => {
                          const total = Object.values(buckets).reduce(
                            (s, n) => s + n,
                            0,
                          );
                          return (
                            <div key={severity} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <Badge className={severityBadge(severity)}>
                                  {severity.replace(/_/g, " ")}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {total} open
                                </span>
                              </div>
                              <div className="flex h-4 rounded overflow-hidden">
                                {Object.entries(buckets).map(
                                  ([bucket, cnt]) => {
                                    const pct =
                                      total > 0 ? (cnt / total) * 100 : 0;
                                    if (pct === 0) return null;
                                    return (
                                      <div
                                        key={bucket}
                                        className={`${BUCKET_COLORS[bucket] ?? "bg-gray-400"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SLA Config */}
            {showConfig && (
              <SlaConfigEditor
                seed={slaSeed}
                onSaved={async () => {
                  await fetchAll();
                  setShowConfig(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </ModuleGate>
  );
}

// ---------------------------------------------------------------------------
// SLA config editor — a form seeded from the server, owning its draft
// ---------------------------------------------------------------------------

function SlaConfigEditor({
  seed,
  onSaved,
}: {
  seed: SlaConfigDraft[];
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("intelligence");
  const [editConfig, setEditConfig] = useState<SlaConfigDraft[]>(() => seed);
  const [saving, setSaving] = useState(false);

  const saveSlaConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/ics/finding-sla", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: editConfig }),
      });
      if (res.ok) {
        await onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{t("findingAnalytics.slaConfigTitle")}</CardTitle>
        <CardDescription>
          {t("findingAnalytics.slaConfigDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {editConfig.map((config, idx) => (
            <div key={config.severity} className="flex items-center gap-4">
              <Badge
                className={`w-56 justify-center ${severityBadge(config.severity)}`}
              >
                {config.severity.replace(/_/g, " ")}
              </Badge>
              <Input
                type="number"
                min={1}
                max={365}
                value={config.slaDays}
                onChange={(e) => {
                  const next = [...editConfig];
                  next[idx] = {
                    ...config,
                    slaDays: Number(e.target.value),
                  };
                  setEditConfig(next);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                {t("findingAnalytics.days")}
              </span>
            </div>
          ))}
          <Button onClick={saveSlaConfig} disabled={saving} className="mt-4">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("findingAnalytics.saveSla")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
