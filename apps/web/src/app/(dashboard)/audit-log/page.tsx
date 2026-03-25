"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import { ShieldCheck, ShieldAlert, Loader2, ArrowRight } from "lucide-react";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  orgId: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  action: string;
  actionDetail: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  previousHash: string | null;
  entryHash: string | null;
  createdAt: string;
}

interface IntegrityCheckResult {
  status: string;
  chainLength: number;
  totalEntries: number;
  brokenLinks: number;
  checkedAt: string;
}

type IntegrityState =
  | { kind: "loading" }
  | { kind: "intact"; data: IntegrityCheckResult }
  | { kind: "broken"; data: IntegrityCheckResult }
  | { kind: "error"; message: string };

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "restore",
  "status_change",
  "approve",
  "reject",
  "assign",
  "unassign",
  "upload_evidence",
  "delete_evidence",
  "acknowledge",
  "export",
  "bulk_update",
  "comment",
  "link",
  "unlink",
] as const;

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 border-green-200",
  update: "bg-blue-100 text-blue-800 border-blue-200",
  delete: "bg-red-100 text-red-800 border-red-200",
  restore: "bg-purple-100 text-purple-800 border-purple-200",
  status_change: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approve: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reject: "bg-rose-100 text-rose-800 border-rose-200",
  assign: "bg-indigo-100 text-indigo-800 border-indigo-200",
  unassign: "bg-orange-100 text-orange-800 border-orange-200",
  upload_evidence: "bg-teal-100 text-teal-800 border-teal-200",
  delete_evidence: "bg-red-100 text-red-800 border-red-200",
  acknowledge: "bg-cyan-100 text-cyan-800 border-cyan-200",
  export: "bg-slate-100 text-slate-800 border-slate-200",
  bulk_update: "bg-blue-100 text-blue-800 border-blue-200",
  comment: "bg-gray-100 text-gray-800 border-gray-200",
  link: "bg-violet-100 text-violet-800 border-violet-200",
  unlink: "bg-amber-100 text-amber-800 border-amber-200",
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ──────────────────────────────────────────────────────────────
// Integrity Badge Component
// ──────────────────────────────────────────────────────────────

function IntegrityBadge({ state, t }: { state: IntegrityState; t: ReturnType<typeof useTranslations> }) {
  if (state.kind === "loading") {
    return (
      <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
        <Loader2 size={14} className="animate-spin" />
        {t("checking")}
      </Badge>
    );
  }

  if (state.kind === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
        <ShieldAlert size={14} />
        {t("integrityCheck")}: {state.message}
      </Badge>
    );
  }

  if (state.kind === "intact") {
    return (
      <Badge className="gap-1.5 border-green-200 bg-green-100 px-3 py-1.5 text-green-800 shadow-none">
        <ShieldCheck size={14} />
        {t("chainIntact")}
        <span className="ml-1 text-xs font-normal text-green-600">
          ({state.data.chainLength} / {state.data.totalEntries})
        </span>
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
      <ShieldAlert size={14} />
      {t("chainBroken")}
      <span className="ml-1 text-xs font-normal">
        ({state.data.brokenLinks} {t("brokenLinks")})
      </span>
    </Badge>
  );
}

// ──────────────────────────────────────────────────────────────
// Change Detail Dialog
// ──────────────────────────────────────────────────────────────

function ChangeDetailDialog({
  entry,
  open,
  onOpenChange,
  t,
}: {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!entry) return null;

  const changes = entry.changes;
  const hasChanges = changes && typeof changes === "object" && Object.keys(changes).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("changeDetail")}</DialogTitle>
          <DialogDescription>
            {entry.entityType} &mdash; {entry.entityTitle ?? entry.entityId}
          </DialogDescription>
        </DialogHeader>

        {/* Change diff table */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">{t("changes")}</h4>
          {hasChanges ? (
            <div className="rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("fieldName")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("oldValue")}
                    </th>
                    <th className="w-6 px-1 py-2" />
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("newValue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(changes).map(([field, diff]) => {
                    const d = diff as { old?: unknown; new?: unknown };
                    return (
                      <tr key={field} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">
                          {field}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700">
                            {displayValue(d.old)}
                          </span>
                        </td>
                        <td className="px-1 py-2 text-center text-gray-400">
                          <ArrowRight size={12} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">
                            {displayValue(d.new)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("noChanges")}</p>
          )}

          {/* Metadata section */}
          <h4 className="text-sm font-semibold text-gray-700">{t("metadata")}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{t("ipAddress")}</dt>
            <dd className="font-mono text-xs text-gray-700">{entry.ipAddress ?? "-"}</dd>

            <dt className="text-gray-500">{t("userAgent")}</dt>
            <dd className="max-w-sm truncate font-mono text-xs text-gray-700">
              {entry.userAgent ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("sessionId")}</dt>
            <dd className="font-mono text-xs text-gray-700">{entry.sessionId ?? "-"}</dd>

            <dt className="text-gray-500">{t("hash")}</dt>
            <dd className="font-mono text-xs text-gray-700">{entry.entryHash ?? "-"}</dd>

            <dt className="text-gray-500">{t("previousHash")}</dt>
            <dd className="font-mono text-xs text-gray-700">{entry.previousHash ?? "-"}</dd>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const t = useTranslations("auditLog");

  // Data state
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrity, setIntegrity] = useState<IntegrityState>({ kind: "loading" });

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>("__all__");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("__all__");

  // Dialog state
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Derive unique entity types from data
  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(e.entityType);
    }
    return Array.from(set).sort();
  }, [entries]);

  // Fetch audit log entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (actionFilter !== "__all__") params.set("action", actionFilter);
      if (entityTypeFilter !== "__all__") params.set("entity_type", entityTypeFilter);

      const res = await fetch(`/api/v1/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: AuditLogEntry[] };
      setEntries(json.data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityTypeFilter]);

  // Fetch integrity check
  const fetchIntegrity = useCallback(async () => {
    setIntegrity({ kind: "loading" });
    try {
      const res = await fetch("/api/v1/audit-log/integrity-check");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: IntegrityCheckResult };
      const data = json.data;
      setIntegrity(
        data.status === "integrity_confirmed"
          ? { kind: "intact", data }
          : { kind: "broken", data },
      );
    } catch (err) {
      setIntegrity({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    void fetchIntegrity();
  }, [fetchIntegrity]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Table columns
  const columns = useMemo<ColumnDef<AuditLogEntry, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("timestamp")}</SortableHeader>
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-gray-600">
            {formatTimestamp(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "userName",
        header: t("user"),
        cell: ({ row }) => {
          const name = row.original.userName;
          const email = row.original.userEmail;
          return (
            <div className="min-w-[120px]">
              <div className="text-sm font-medium text-gray-900">{name ?? "-"}</div>
              {email && <div className="text-xs text-gray-500">{email}</div>}
            </div>
          );
        },
      },
      {
        accessorKey: "action",
        header: t("action"),
        cell: ({ getValue }) => {
          const action = getValue() as string;
          const colorClass = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-800 border-gray-200";
          return (
            <Badge
              variant="outline"
              className={`${colorClass} text-xs font-medium`}
            >
              {action.replace(/_/g, " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "entityType",
        header: t("entityType"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-gray-600">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "entityTitle",
        header: t("entityTitle"),
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="max-w-[200px] truncate text-sm text-gray-700">
              {val ?? "-"}
            </span>
          );
        },
      },
      {
        accessorKey: "changes",
        header: t("changes"),
        enableSorting: false,
        cell: ({ row }) => {
          const changes = row.original.changes;
          if (!changes || typeof changes !== "object") {
            return <span className="text-xs text-gray-400">-</span>;
          }
          const fieldCount = Object.keys(changes).length;
          return (
            <button
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntry(row.original);
                setDialogOpen(true);
              }}
            >
              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
            </button>
          );
        },
      },
    ],
    [t],
  );

  // Row click handler
  const handleRowClick = useCallback((entry: AuditLogEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  }, []);

  // Custom toolbar with filter dropdowns
  const toolbar = (
    <div className="flex items-center gap-2">
      <Select value={actionFilter} onValueChange={setActionFilter}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder={t("allActions")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t("allActions")}</SelectItem>
          {AUDIT_ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder={t("allEntityTypes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t("allEntityTypes")}</SelectItem>
          {entityTypes.map((et) => (
            <SelectItem key={et} value={et}>
              {et}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <IntegrityBadge state={integrity} t={t} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <AuditLogTable
          data={entries}
          columns={columns}
          toolbar={toolbar}
          searchPlaceholder={t("searchEntity")}
          onRowClick={handleRowClick}
        />
      )}

      {/* Detail dialog */}
      <ChangeDetailDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        t={t}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Audit Log Table wrapper (adds row click)
// ──────────────────────────────────────────────────────────────

function AuditLogTable({
  data,
  columns,
  toolbar,
  searchPlaceholder,
  onRowClick,
}: {
  data: AuditLogEntry[];
  columns: ColumnDef<AuditLogEntry, unknown>[];
  toolbar: React.ReactNode;
  searchPlaceholder: string;
  onRowClick: (entry: AuditLogEntry) => void;
}) {
  // We render DataTable but wrap rows with click handlers via a wrapper
  // DataTable does not natively support row click, so we wrap it and
  // add a click listener at the table container level
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const row = target.closest("tbody tr[data-row-index]");
        if (!row) return;
        const idx = Number(row.getAttribute("data-row-index"));
        if (!Number.isNaN(idx) && data[idx]) {
          onRowClick(data[idx]);
        }
      }}
    >
      <DataTableWithRowIndex
        data={data}
        columns={columns}
        toolbar={toolbar}
        searchKey="entityTitle"
        searchPlaceholder={searchPlaceholder}
        pageSize={15}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DataTable variant that marks rows with data-row-index
// ──────────────────────────────────────────────────────────────

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function DataTableWithRowIndex<TData>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Filter...",
  pageSize = 10,
  toolbar,
}: {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {searchKey && (
          <input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="rounded-md border border-gray-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-row-index={row.index}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-500"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{table.getFilteredRowModel().rows.length} row(s)</span>
        <div className="flex items-center gap-2">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
