"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import {
  Loader2,
  Search,
  RefreshCcw,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { FindingSeverityBadge } from "@/components/control/finding-severity-badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FindingSeverity, FindingStatus, FindingSource } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FindingRow {
  id: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  source: FindingSource;
  ownerId?: string;
  ownerName?: string;
  remediationDueDate?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITIES: FindingSeverity[] = [
  "observation",
  "recommendation",
  "improvement_requirement",
  "insignificant_nonconformity",
  "significant_nonconformity",
];

const STATUSES: FindingStatus[] = [
  "identified",
  "in_remediation",
  "remediated",
  "verified",
  "accepted",
  "closed",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

function statusBadgeClass(status: FindingStatus): string {
  const map: Record<FindingStatus, string> = {
    identified: "bg-gray-100 text-gray-700 border-gray-200",
    in_remediation: "bg-blue-100 text-blue-800 border-blue-200",
    remediated: "bg-cyan-100 text-cyan-800 border-cyan-200",
    verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accepted: "bg-yellow-100 text-yellow-800 border-yellow-200",
    closed: "bg-slate-200 text-slate-600 border-slate-300",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FindingsPage() {
  return (
    <ModuleGate moduleKey="ics">
      <ModuleTabNav />
      <FindingsPageInner />
    </ModuleGate>
  );
}

function FindingsPageInner() {
  const t = useTranslations("findings");
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/findings?limit=500&sortBy=createdAt&sortDir=desc");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setFindings(json.data ?? []);
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFindings();
  }, [fetchFindings]);

  const filtered = useMemo(() => {
    if (statusFilter === "__all__") return findings;
    return findings.filter((f) => f.status === statusFilter);
  }, [findings, statusFilter]);

  // KPIs
  const total = findings.length;
  const open = findings.filter((f) => !["closed", "verified", "accepted"].includes(f.status)).length;
  const overdue = findings.filter((f) => {
    if (!f.remediationDueDate) return false;
    return new Date(f.remediationDueDate) < new Date() && !["closed", "verified"].includes(f.status);
  }).length;

  // Severity distribution
  const severityDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const s of SEVERITIES) dist[s] = 0;
    for (const f of findings) {
      dist[f.severity] = (dist[f.severity] ?? 0) + 1;
    }
    return dist;
  }, [findings]);

  const columns: ColumnDef<FindingRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/controls/findings/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "severity",
        header: t("form.severity"),
        cell: ({ row }) => <FindingSeverityBadge severity={row.original.severity} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.status")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className={statusBadgeClass(row.original.status)}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "source",
        header: t("form.source"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {t(`source.${row.original.source}`)}
          </span>
        ),
      },
      {
        id: "owner",
        header: t("form.owner"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.ownerName ?? "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "remediationDueDate",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.dueDate")}</SortableHeader>
        ),
        cell: ({ row }) => {
          const due = row.original.remediationDueDate;
          const isOverdue = due && new Date(due) < new Date() && !["closed", "verified"].includes(row.original.status);
          return (
            <span className={`text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>
              {formatDate(due)}
            </span>
          );
        },
      },
    ],
    [t],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchFindings()} disabled={loading}>
          <RefreshCcw size={14} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <AlertTriangle size={20} className="text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">{t("kpi.total")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{open}</p>
              <p className="text-xs text-gray-500">{t("kpi.open")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{overdue}</p>
              <p className="text-xs text-gray-500">{t("kpi.overdue")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium text-gray-700 mb-3">{t("distribution.title")}</p>
          <div className="flex items-end gap-2 h-24">
            {SEVERITIES.map((s) => {
              const count = severityDist[s] ?? 0;
              const maxCount = Math.max(...Object.values(severityDist), 1);
              const heightPct = (count / maxCount) * 100;
              const colorMap: Record<string, string> = {
                observation: "bg-gray-400",
                recommendation: "bg-blue-500",
                improvement_requirement: "bg-yellow-500",
                insignificant_nonconformity: "bg-orange-500",
                significant_nonconformity: "bg-red-500",
              };
              return (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-gray-600">{count}</span>
                  <div
                    className={`w-full rounded-t ${colorMap[s] ?? "bg-gray-300"}`}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[9px] text-gray-500 text-center truncate w-full">
                    {t(`severity.${s}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("form.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Search size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("empty.noFindings")}</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="title"
          searchPlaceholder={t("searchPlaceholder")}
          pageSize={15}
        />
      )}
    </div>
  );
}
