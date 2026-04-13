"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Filter,
  Cable,
  ArrowDownUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────

interface SyncLogEntry {
  id: string;
  connectorInstanceId: string;
  connectorName: string;
  connectorType: string;
  status: "success" | "failed" | "running";
  recordsPulled: number;
  recordsWritten: number;
  errorCount: number;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "---";
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

function StatusBadge({ status }: { status: SyncLogEntry["status"] }) {
  switch (status) {
    case "success":
      return (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-green-700"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Erfolgreich
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700"
        >
          <XCircle className="mr-1 h-3 w-3" />
          Fehlgeschlagen
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700"
        >
          <Play className="mr-1 h-3 w-3" />
          Aktiv
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Component ─────────────────────────────────────────────────

export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterConnector, setFilterConnector] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterConnector !== "all")
        params.set("connectorInstanceId", filterConnector);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const url = `/api/v1/connectors/sync-log${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({ data: [] }));
      setLogs(json.data ?? []);
    } catch {
      setError(
        "Synchronisations-Protokoll konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [filterConnector, filterStatus]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Unique connector names for filter dropdown
  const connectorOptions = Array.from(
    new Map(
      logs.map((l) => [l.connectorInstanceId, l.connectorName]),
    ),
  );

  // Stats
  const totalRuns = logs.length;
  const successRuns = logs.filter((l) => l.status === "success").length;
  const failedRuns = logs.filter((l) => l.status === "failed").length;
  const runningRuns = logs.filter((l) => l.status === "running").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ArrowDownUp className="h-6 w-6" />
            Synchronisations-Protokoll
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verlauf aller Konnektor-Synchronisationen
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Clock className="mx-auto h-5 w-5 text-gray-400" />
            <p className="mt-1 text-lg font-semibold">{totalRuns}</p>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
            <p className="mt-1 text-lg font-semibold">{successRuns}</p>
            <p className="text-xs text-muted-foreground">Erfolgreich</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <XCircle
              className={`mx-auto h-5 w-5 ${failedRuns > 0 ? "text-red-500" : "text-gray-400"}`}
            />
            <p
              className={`mt-1 text-lg font-semibold ${failedRuns > 0 ? "text-red-600" : ""}`}
            >
              {failedRuns}
            </p>
            <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Play
              className={`mx-auto h-5 w-5 ${runningRuns > 0 ? "text-blue-500" : "text-gray-400"}`}
            />
            <p className="mt-1 text-lg font-semibold">{runningRuns}</p>
            <p className="text-xs text-muted-foreground">Aktiv</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex items-center gap-4 py-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Konnektor:</span>
            <Select value={filterConnector} onValueChange={setFilterConnector}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle Konnektoren" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Konnektoren</SelectItem>
                {connectorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="running">Aktiv</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cable className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">
              Keine Synchronisationen gefunden
            </p>
            <p className="mt-1 text-sm">
              Sobald Konnektoren synchronisieren, erscheinen die Einträge hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Synchronisations-Verlauf
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Konnektor</th>
                    <th className="pb-3 pr-4 font-medium">Typ</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Gezogen
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Geschrieben
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Fehler
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      Dauer
                    </th>
                    <th className="pb-3 font-medium">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {log.connectorName}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-[10px]">
                          {log.connectorType}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {log.recordsPulled.toLocaleString("de-DE")}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {log.recordsWritten.toLocaleString("de-DE")}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        <span
                          className={
                            log.errorCount > 0
                              ? "font-medium text-red-600"
                              : ""
                          }
                        >
                          {log.errorCount.toLocaleString("de-DE")}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                        {log.status === "running" ? (
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                        ) : (
                          formatDuration(log.durationMs)
                        )}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        {formatDate(log.startedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
