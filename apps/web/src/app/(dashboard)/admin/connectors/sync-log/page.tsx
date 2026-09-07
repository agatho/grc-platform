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
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch.
 * `StatusBadge` und `formatDuration` stehen ausserhalb der Komponente;
 * `StatusBadge` ist selbst eine Komponente und darf den Hook lesen,
 * `formatDuration` nimmt die Uebersetzungsfunktion als Parameter.
 */

/** Die Uebersetzungsfunktion, wie sie `formatDuration` braucht. */
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

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

function formatDuration(ms: number, t: Translate): string {
  if (ms < 1000) return t("syncLog.duration.ms", { value: ms });
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return t("syncLog.duration.s", { value: seconds });
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60)
    return t("syncLog.duration.ms_s", {
      minutes,
      seconds: remainingSec,
    });
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return t("syncLog.duration.h_m", { hours, minutes: remainingMin });
}

function StatusBadge({ status }: { status: SyncLogEntry["status"] }) {
  const t = useTranslations("admin");
  switch (status) {
    case "success":
      return (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-green-700"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {t("syncLog.status.success")}
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700"
        >
          <XCircle className="mr-1 h-3 w-3" />
          {t("syncLog.status.failed")}
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700"
        >
          <Play className="mr-1 h-3 w-3" />
          {t("syncLog.status.running")}
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Component ─────────────────────────────────────────────────

export default function SyncLogPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDateTime, formatNumber } = useDateFormat();
  const formatDate = (d: string | null) =>
    formatDateTime(d, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
      setError(t("syncLog.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterConnector, filterStatus, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Unique connector names for filter dropdown
  const connectorOptions = Array.from(
    new Map(logs.map((l) => [l.connectorInstanceId, l.connectorName])),
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
            {t("syncLog.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("syncLog.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          {tCommon("actions.refresh")}
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
            <p className="text-xs text-muted-foreground">
              {t("syncLog.kpi.total")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
            <p className="mt-1 text-lg font-semibold">{successRuns}</p>
            <p className="text-xs text-muted-foreground">
              {t("syncLog.status.success")}
            </p>
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
            <p className="text-xs text-muted-foreground">
              {t("syncLog.status.failed")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Play
              className={`mx-auto h-5 w-5 ${runningRuns > 0 ? "text-blue-500" : "text-gray-400"}`}
            />
            <p className="mt-1 text-lg font-semibold">{runningRuns}</p>
            <p className="text-xs text-muted-foreground">
              {t("syncLog.status.running")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex items-center gap-4 py-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("syncLog.filterConnector")}
            </span>
            <Select value={filterConnector} onValueChange={setFilterConnector}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("syncLog.allConnectors")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("syncLog.allConnectors")}
                </SelectItem>
                {connectorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("syncLog.filterStatus")}
            </span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("approvalRequests.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("approvalRequests.allStatuses")}
                </SelectItem>
                <SelectItem value="success">
                  {t("syncLog.status.success")}
                </SelectItem>
                <SelectItem value="failed">
                  {t("syncLog.status.failed")}
                </SelectItem>
                <SelectItem value="running">
                  {t("syncLog.status.running")}
                </SelectItem>
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
            <p className="font-medium">{t("syncLog.empty")}</p>
            <p className="mt-1 text-sm">{t("syncLog.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("syncLog.tableTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      {t("syncLog.column.connector")}
                    </th>
                    <th className="pb-3 pr-4 font-medium">
                      {t("dataLinks.column.type")}
                    </th>
                    <th className="pb-3 pr-4 font-medium">
                      {t("reminders.column.status")}
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      {t("syncLog.column.pulled")}
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      {t("syncLog.column.written")}
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      {t("syncLog.column.errors")}
                    </th>
                    <th className="pb-3 pr-4 font-medium text-right">
                      {t("syncLog.column.duration")}
                    </th>
                    <th className="pb-3 font-medium">
                      {t("syncLog.column.timestamp")}
                    </th>
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
                        {formatNumber(log.recordsPulled)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(log.recordsWritten)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        <span
                          className={
                            log.errorCount > 0 ? "font-medium text-red-600" : ""
                          }
                        >
                          {formatNumber(log.errorCount)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                        {log.status === "running" ? (
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                        ) : (
                          formatDuration(log.durationMs, t)
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
