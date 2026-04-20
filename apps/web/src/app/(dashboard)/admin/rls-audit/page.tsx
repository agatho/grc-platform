"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
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
  const locale = useLocale();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("gaps");

  const t = (de: string, en: string) => (locale === "de" ? de : en);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/rls-audit");
      if (res.status !== 200 && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: AuditReport };
      setReport(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReport();
  }, []);

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
              {t("RLS-Audit", "RLS audit")}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {t(
                "Deckung der Row-Level-Security-Policies über alle mandantenbezogenen Tabellen. ADR-001 erzwingt Isolation je org_id auf der Datenbankschicht.",
                "Coverage of Row-Level-Security policies across every tenant-scoped table. ADR-001 enforces org_id isolation at the database layer.",
              )}
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
          {t("Erneut prüfen", "Re-run")}
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
                ? t(
                    "Alle Mandanten-Tabellen sind RLS-geschützt",
                    "All tenant tables are RLS-protected",
                  )
                : t(
                    `${report.counts.tenantTables - report.counts.tenantsOk} von ${report.counts.tenantTables} Mandanten-Tabellen haben Lücken`,
                    `${report.counts.tenantTables - report.counts.tenantsOk} of ${report.counts.tenantTables} tenant tables have gaps`,
                  )}
            </div>
            <div className="mt-1 text-sm opacity-90">
              {t(
                `Geprüft am ${new Date(report.generatedAt).toLocaleString("de-DE")}. Gesamt ${report.counts.totalTables} Tabellen, davon ${report.counts.tenantTables} mandantenbezogen und ${report.counts.platformTables} plattform-global.`,
                `Checked at ${new Date(report.generatedAt).toLocaleString("en-US")}. Total ${report.counts.totalTables} tables — ${report.counts.tenantTables} tenant-scoped, ${report.counts.platformTables} platform-global.`,
              )}
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
            label={t("OK", "OK")}
            count={report.counts.tenantsOk}
            tone="green"
            icon={<CheckCircle size={12} />}
          />
          <CountChip
            label={t("RLS fehlt", "RLS missing")}
            count={report.counts.tenantsMissingRls}
            tone="red"
            icon={<XCircle size={12} />}
          />
          <CountChip
            label={t("FORCE fehlt", "FORCE missing")}
            count={report.counts.tenantsMissingForce}
            tone="amber"
            icon={<AlertTriangle size={12} />}
          />
          <CountChip
            label={t("Policies fehlen", "Policies missing")}
            count={report.counts.tenantsMissingPolicies}
            tone="amber"
            icon={<AlertTriangle size={12} />}
          />
          <CountChip
            label={t("Plattform-Tabellen", "Platform tables")}
            count={report.counts.platformTables}
            tone="gray"
            icon={<Info size={12} />}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(
          [
            ["gaps", t("Nur Lücken", "Gaps only")],
            ["tenant", t("Alle Mandanten-Tabellen", "All tenant tables")],
            ["all", t("Alles", "Everything")],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === mode
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Tabelle", "Table")}</TableHead>
              <TableHead>{t("Scope", "Scope")}</TableHead>
              <TableHead>RLS</TableHead>
              <TableHead>FORCE</TableHead>
              <TableHead>{t("Policies", "Policies")}</TableHead>
              <TableHead>{t("Status", "Status")}</TableHead>
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
                    ? t("Keine Lücken — gut gemacht.", "No gaps — well done.")
                    : t("Keine Einträge.", "No entries.")}
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
  const statusBadge = (() => {
    switch (row.status) {
      case "ok":
        return (
          <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 shadow-none">
            <CheckCircle size={10} /> OK
          </Badge>
        );
      case "missing_rls":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle size={10} /> RLS missing
          </Badge>
        );
      case "missing_force":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-amber-800"
          >
            <AlertTriangle size={10} /> FORCE missing
          </Badge>
        );
      case "missing_policies":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-amber-800"
          >
            <AlertTriangle size={10} /> Policies missing
          </Badge>
        );
      case "platform_ignored":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-gray-200 bg-gray-50 text-gray-600"
          >
            <Info size={10} /> Platform
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
          {row.scope}
        </Badge>
      </TableCell>
      <TableCell>
        {row.rlsEnabled ? (
          <CheckCircle size={14} className="text-emerald-600" />
        ) : row.scope === "tenant" ? (
          <XCircle size={14} className="text-red-600" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </TableCell>
      <TableCell>
        {row.rlsForced ? (
          <CheckCircle size={14} className="text-emerald-600" />
        ) : row.rlsEnabled ? (
          <AlertTriangle size={14} className="text-amber-600" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
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
