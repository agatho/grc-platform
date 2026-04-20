"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Severity = "critical" | "high" | "medium" | "low" | "observation";
type Status =
  | "open"
  | "in_progress"
  | "resolved"
  | "verified"
  | "closed"
  | "accepted";
type Module =
  | "ics"
  | "audit"
  | "isms_cap"
  | "ai_act_incident"
  | "ai_act_corrective"
  | "dpms_breach"
  | "bcms_exercise";

interface PrioritizedFinding {
  id: string;
  sourceId: string;
  module: Module;
  title: string;
  severity: Severity;
  status: Status;
  identifiedAt: string;
  dueDate: string | null;
  ownerId: string | null;
  linkPath: string;
  priorityScore: number;
  isOverdue: boolean;
  daysOpen: number;
}

interface CrossFindingAggregate {
  total: number;
  byModule: Record<Module, number>;
  bySeverity: Record<Severity, number>;
  byStatus: Record<Status, number>;
  openCount: number;
  overdueCount: number;
  criticalOpenCount: number;
  oldestOpenAgeDays: number | null;
}

interface CrossFindingResponse {
  aggregate: CrossFindingAggregate;
  topPrioritized: PrioritizedFinding[];
  totalFindings: number;
}

const MODULE_LABELS: Record<Module, string> = {
  ics: "ICS Control",
  audit: "Audit",
  isms_cap: "ISMS CAP",
  ai_act_incident: "AI Incident",
  ai_act_corrective: "AI CAPA",
  dpms_breach: "Data Breach",
  bcms_exercise: "BC Exercise",
};

const SEVERITY_META: Record<
  Severity,
  { label: string; className: string; weight: number }
> = {
  critical: {
    label: "CRITICAL",
    className: "bg-red-100 text-red-800 border-red-300",
    weight: 5,
  },
  high: {
    label: "HIGH",
    className: "bg-orange-100 text-orange-800 border-orange-300",
    weight: 4,
  },
  medium: {
    label: "MEDIUM",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    weight: 3,
  },
  low: {
    label: "LOW",
    className: "bg-sky-100 text-sky-800 border-sky-300",
    weight: 2,
  },
  observation: {
    label: "OBS",
    className: "bg-slate-100 text-slate-700 border-slate-300",
    weight: 1,
  },
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Behoben",
  verified: "Verifiziert",
  closed: "Geschlossen",
  accepted: "Akzeptiert",
};

function SeverityPill({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

export default function GrcFindingsPage() {
  const [data, setData] = useState<CrossFindingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<Module | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/cross/findings?top=100");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.topPrioritized.filter((f) => {
      if (filterModule !== "all" && f.module !== filterModule) return false;
      if (filterSeverity !== "all" && f.severity !== filterSeverity)
        return false;
      if (showOnlyOverdue && !f.isOverdue) return false;
      return true;
    });
  }, [data, filterModule, filterSeverity, showOnlyOverdue]);

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
              <p className="font-medium">
                Findings konnten nicht geladen werden
              </p>
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

  const agg = data.aggregate;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cross-Module Findings
          </h1>
          <p className="text-muted-foreground mt-1">
            Vereinheitlichte Ansicht aus ICS, Audit, ISMS-CAP, AI-Act, DPMS,
            BCMS.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Gesamt</p>
            <p className="text-2xl font-bold">{agg.total}</p>
          </CardContent>
        </Card>
        <Card className={agg.openCount > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Offen
            </p>
            <p className="text-2xl font-bold text-amber-600">{agg.openCount}</p>
          </CardContent>
        </Card>
        <Card className={agg.overdueCount > 0 ? "border-red-300" : ""}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ueberfaellig
            </p>
            <p className="text-2xl font-bold text-red-600">
              {agg.overdueCount}
            </p>
          </CardContent>
        </Card>
        <Card
          className={
            agg.criticalOpenCount > 0 ? "border-red-500 bg-red-50/30" : ""
          }
        >
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Critical offen</p>
            <p className="text-2xl font-bold text-red-700">
              {agg.criticalOpenCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nach Modul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(agg.byModule)
              .filter(([, c]) => c > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([mod, count]) => (
                <div key={mod} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {MODULE_LABELS[mod as Module]}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nach Schwere</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(agg.bySeverity)
              .filter(([, c]) => c > 0)
              .sort(
                ([a], [b]) =>
                  SEVERITY_META[b as Severity].weight -
                  SEVERITY_META[a as Severity].weight,
              )
              .map(([sev, count]) => (
                <div key={sev} className="flex justify-between items-center">
                  <SeverityPill severity={sev as Severity} />
                  <span className="font-medium">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nach Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(agg.byStatus)
              .filter(([, c]) => c > 0)
              .map(([s, count]) => (
                <div key={s} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {STATUS_LABEL[s as Status]}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-sm">Filter</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Modul:</label>
            <Select
              value={filterModule}
              onValueChange={(v) => setFilterModule(v as Module | "all")}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {Object.entries(MODULE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Schwere:</label>
            <Select
              value={filterSeverity}
              onValueChange={(v) => setFilterSeverity(v as Severity | "all")}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={showOnlyOverdue ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyOverdue((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Nur ueberfaellig
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Zeige {filtered.length} von {data.topPrioritized.length}
          </span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Priorisierte Findings</CardTitle>
          <CardDescription>
            Sortiert nach Score: Schwere x Alter x Ueberfaelligkeit. Max 300.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Keine Findings fuer die aktuellen Filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-xs uppercase">
                      Score
                    </th>
                    <th className="text-left p-3 font-medium text-xs uppercase">
                      Schwere
                    </th>
                    <th className="text-left p-3 font-medium text-xs uppercase">
                      Modul
                    </th>
                    <th className="text-left p-3 font-medium text-xs uppercase">
                      Titel
                    </th>
                    <th className="text-left p-3 font-medium text-xs uppercase">
                      Status
                    </th>
                    <th className="text-right p-3 font-medium text-xs uppercase">
                      Tage offen
                    </th>
                    <th className="text-right p-3 font-medium text-xs uppercase">
                      Faellig
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      className={`border-b hover:bg-muted/30 ${f.isOverdue ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                    >
                      <td className="p-3 font-mono font-bold">
                        {f.priorityScore}
                      </td>
                      <td className="p-3">
                        <SeverityPill severity={f.severity} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {MODULE_LABELS[f.module]}
                      </td>
                      <td className="p-3">
                        <Link href={f.linkPath} className="hover:underline">
                          {f.title}
                        </Link>
                      </td>
                      <td className="p-3 text-xs">{STATUS_LABEL[f.status]}</td>
                      <td className="p-3 text-right text-xs">{f.daysOpen}d</td>
                      <td className="p-3 text-right text-xs">
                        {f.isOverdue ? (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-800 border-red-300"
                          >
                            ueberfaellig
                          </Badge>
                        ) : f.dueDate ? (
                          new Date(f.dueDate).toLocaleDateString("de-DE")
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
