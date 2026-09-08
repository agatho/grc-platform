"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Die LETZTE Datei mit festem
 * Gebietsschema. Welle 5a hatte hier eine Teilaenderung ZURUECKGENOMMEN: die
 * Datei fuehrte ihre eigene Zweisprachigkeit (`const t = (de, en) => …`) und
 * waehlte in JEDEM der beiden Zweige das passende Tag — `de-DE` im deutschen,
 * `en-US` im englischen. Ein `numberLocale` nur an einer Stelle haette sie
 * inkonsistent gemacht: der deutsche Zweig waere dem Cookie gefolgt, der
 * englische fest geblieben. Deshalb galt: ganz oder gar nicht.
 *
 * Jetzt ganz. Die Seite bindet den Katalog, das Datum kommt aus
 * `useDateFormat()` — und damit ist die Zahl der Fundstellen mit festem
 * Gebietsschema im Bildschirmbereich auf NULL.
 *
 * Mitgenommen: Die Haken und Kreuze in den Spalten RLS und FORCE waren reine
 * Symbole ohne zugaenglichen Namen. Ein Screenreader las eine Zeile als
 * "org_unit, tenant, (nichts), (nichts), SELECT INSERT, OK" — die beiden
 * Spalten, um die es auf dieser Seite geht, fehlten. Sie tragen jetzt einen.
 */
interface TableStatus {
  tableName: string;
  scope: "platform" | "tenant";
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: string[];
  coveredCommands: string[];
  status:
    | "ok"
    | "missing_rls"
    | "missing_force"
    | "missing_policies"
    | "platform_ignored";
  note?: string;
}

interface AuditReport {
  generatedAt: string;
  counts: {
    totalTables: number;
    tenantTables: number;
    platformTables: number;
    tenantsOk: number;
    tenantsMissingRls: number;
    tenantsMissingForce: number;
    tenantsMissingPolicies: number;
  };
  tables: TableStatus[];
}

type FilterMode = "gaps" | "tenant" | "all";

export default function RlsAuditPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDateTime } = useDateFormat();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("gaps");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/rls-audit");
      if (res.status !== 200 && res.status !== 503) {
        throw new Error(tCommon("common.httpError", { status: res.status }));
      }
      const json = (await res.json()) as { data: AuditReport };
      setReport(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  // [Welle 7a · OP-080] `fetchReport` steht jetzt in `useCallback` und in den
  // Abhaengigkeiten des Effekts. Die leere Liste war eine Behauptung ueber
  // eine Funktion, die bei jedem Rendern neu entsteht.
  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const filtered = useMemo(() => {
    if (!report) return [];
    switch (filter) {
      case "gaps":
        return report.tables.filter(
          (x) =>
            x.status === "missing_rls" ||
            x.status === "missing_force" ||
            x.status === "missing_policies",
        );
      case "tenant":
        return report.tables.filter((x) => x.scope === "tenant");
      case "all":
        return report.tables;
    }
  }, [report, filter]);

  const allGood =
    report && report.counts.tenantsOk === report.counts.tenantTables;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("rlsAudit.title")}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {t("rlsAudit.description")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchReport}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {t("rlsAudit.rerun")}
        </button>
      </div>

      {/* Status banner */}
      {report && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${
            allGood
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {allGood ? (
            <ShieldCheck
              size={22}
              className="mt-0.5 shrink-0 text-emerald-700"
            />
          ) : (
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-red-700" />
          )}
          <div className="flex-1">
            <div className="text-lg font-semibold">
              {allGood
                ? t("rlsAudit.allProtected")
                : t("rlsAudit.gapsFound", {
                    gaps: report.counts.tenantTables - report.counts.tenantsOk,
                    total: report.counts.tenantTables,
                  })}
            </div>
            <div className="mt-1 text-sm opacity-90">
              {t("rlsAudit.checkedAt", {
                value: formatDateTime(report.generatedAt),
                total: report.counts.totalTables,
                tenant: report.counts.tenantTables,
                platform: report.counts.platformTables,
              })}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Count chips */}
      {report && (
        <div className="flex flex-wrap items-center gap-2">
          <CountChip
            label={t("rlsAudit.chip.ok")}
            count={report.counts.tenantsOk}
            tone="green"
            icon={<CheckCircle size={12} />}
          />
          <CountChip
            label={t("rlsAudit.chip.missingRls")}
            count={report.counts.tenantsMissingRls}
            tone="red"
            icon={<XCircle size={12} />}
          />
          <CountChip
            label={t("rlsAudit.chip.missingForce")}
            count={report.counts.tenantsMissingForce}
            tone="amber"
            icon={<AlertTriangle size={12} />}
          />
          <CountChip
            label={t("rlsAudit.chip.missingPolicies")}
            count={report.counts.tenantsMissingPolicies}
            tone="amber"
            icon={<AlertTriangle size={12} />}
          />
          <CountChip
            label={t("rlsAudit.chip.platformTables")}
            count={report.counts.platformTables}
            tone="gray"
            icon={<Info size={12} />}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["gaps", "tenant", "all"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === mode
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
            }`}
          >
            {t(`rlsAudit.filter.${mode}`)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rlsAudit.column.table")}</TableHead>
              <TableHead>{t("rlsAudit.column.scope")}</TableHead>
              <TableHead>{t("rlsAudit.column.rls")}</TableHead>
              <TableHead>{t("rlsAudit.column.force")}</TableHead>
              <TableHead>{t("rlsAudit.column.policies")}</TableHead>
              <TableHead>{t("rlsAudit.column.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-gray-500"
                >
                  {filter === "gaps"
                    ? t("rlsAudit.noGaps")
                    : t("rlsAudit.noEntries")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => <AuditRow key={row.tableName} row={row} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CountChip({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "green" | "red" | "amber" | "gray";
  icon: React.ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={`gap-1 px-2.5 py-1 ${styles[tone]}`}>
      {icon}
      {label}: <span className="font-semibold tabular-nums">{count}</span>
    </Badge>
  );
}

function AuditRow({ row }: { row: TableStatus }) {
  const t = useTranslations("admin");
  const statusBadge = (() => {
    switch (row.status) {
      case "ok":
        return (
          <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 shadow-none">
            <CheckCircle size={10} /> {t("rlsAudit.status.ok")}
          </Badge>
        );
      case "missing_rls":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle size={10} /> {t("rlsAudit.status.missing_rls")}
          </Badge>
        );
      case "missing_force":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-amber-800"
          >
            <AlertTriangle size={10} /> {t("rlsAudit.status.missing_force")}
          </Badge>
        );
      case "missing_policies":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-amber-800"
          >
            <AlertTriangle size={10} /> {t("rlsAudit.status.missing_policies")}
          </Badge>
        );
      case "platform_ignored":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-gray-200 bg-gray-50 text-gray-600"
          >
            <Info size={10} /> {t("rlsAudit.status.platform_ignored")}
          </Badge>
        );
    }
  })();

  return (
    <TableRow className={row.status === "ok" ? "" : "bg-red-50/30"}>
      <TableCell className="font-mono text-xs">{row.tableName}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.scope === "tenant"
              ? "border-blue-200 bg-blue-50 text-blue-800"
              : "border-gray-200 bg-gray-50 text-gray-600"
          }
        >
          {t(`rlsAudit.scope.${row.scope}`)}
        </Badge>
      </TableCell>
      <TableCell>
        {row.rlsEnabled ? (
          <CheckCircle
            size={14}
            className="text-emerald-600"
            aria-label={t("rlsAudit.cell.rlsOn")}
          />
        ) : row.scope === "tenant" ? (
          <XCircle
            size={14}
            className="text-red-600"
            aria-label={t("rlsAudit.cell.rlsOff")}
          />
        ) : (
          <span className="text-xs text-gray-400">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("rlsAudit.cell.notApplicable")}</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {row.rlsForced ? (
          <CheckCircle
            size={14}
            className="text-emerald-600"
            aria-label={t("rlsAudit.cell.forceOn")}
          />
        ) : row.rlsEnabled ? (
          <AlertTriangle
            size={14}
            className="text-amber-600"
            aria-label={t("rlsAudit.cell.forceOff")}
          />
        ) : (
          <span className="text-xs text-gray-400">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("rlsAudit.cell.notApplicable")}</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {row.coveredCommands.length === 0 ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            row.coveredCommands.map((c) => (
              <span
                key={c}
                className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700"
              >
                {c}
              </span>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          {statusBadge}
          {row.note && (
            <div className="text-[11px] text-gray-500">{row.note}</div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
