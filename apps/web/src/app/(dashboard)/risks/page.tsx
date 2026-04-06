"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Search,
  List,
  LayoutGrid,
  Download,
  RefreshCcw,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { RiskHeatMap, type HeatMapCell } from "@/components/risk/risk-heat-map";
import { RiskScoreBadge } from "@/components/risk/risk-score-badge";
import { RiskStatusBadge } from "@/components/risk/risk-status-badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RiskCategory, RiskStatus, TreatmentStrategy } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskRow {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  riskCategory: RiskCategory;
  riskSource: string;
  status: RiskStatus;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  department?: string;
  inherentLikelihood?: number;
  inherentImpact?: number;
  residualLikelihood?: number;
  residualImpact?: number;
  riskScoreInherent?: number;
  riskScoreResidual?: number;
  treatmentStrategy?: TreatmentStrategy;
  riskAppetiteExceeded: boolean;
  reviewDate?: string;
  elementId?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardSummary {
  totalRisks: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  appetiteExceededCount: number;
  top10Risks: Array<{
    id: string;
    title: string;
    riskCategory: string;
    status: string;
    riskScoreResidual?: number;
    riskScoreInherent?: number;
    riskAppetiteExceeded: boolean;
    ownerId?: string;
  }>;
  heatMapCells: HeatMapCell[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: RiskCategory[] = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
];

const STATUSES: RiskStatus[] = [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
];

const STRATEGIES: TreatmentStrategy[] = [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryBadgeClass(category: RiskCategory): string {
  const map: Record<RiskCategory, string> = {
    strategic: "bg-indigo-100 text-indigo-900 border-indigo-200",
    operational: "bg-blue-100 text-blue-900 border-blue-200",
    financial: "bg-emerald-100 text-emerald-900 border-emerald-200",
    compliance: "bg-violet-100 text-violet-900 border-violet-200",
    cyber: "bg-red-100 text-red-900 border-red-200",
    reputational: "bg-orange-100 text-orange-900 border-orange-200",
    esg: "bg-teal-100 text-teal-900 border-teal-200",
  };
  return map[category] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function strategyBadgeClass(strategy: TreatmentStrategy): string {
  const map: Record<TreatmentStrategy, string> = {
    mitigate: "bg-blue-50 text-blue-800 border-blue-200",
    accept: "bg-yellow-50 text-yellow-800 border-yellow-200",
    transfer: "bg-purple-50 text-purple-800 border-purple-200",
    avoid: "bg-red-50 text-red-800 border-red-200",
  };
  return map[strategy] ?? "bg-gray-50 text-gray-600 border-gray-200";
}

function reviewDateClass(dateStr?: string): string {
  if (!dateStr) return "text-gray-400";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-red-600 font-semibold";
  if (diffDays <= 7) return "text-orange-600 font-medium";
  if (diffDays <= 30) return "text-yellow-700";
  return "text-gray-600";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RisksPage() {
  return (
    <ModuleGate moduleKey="erm">
      <RisksPageInner />
    </ModuleGate>
  );
}

function RisksPageInner() {
  const t = useTranslations("risk");
  const tActions = useTranslations("actions");
  const router = useRouter();
  const { data: session } = useSession();

  // Data state
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [ownerFilter, setOwnerFilter] = useState<string>("__all__");
  const [appetiteOnly, setAppetiteOnly] = useState(false);

  // Heat map state — initialize from URL query params (e.g. ?likelihood=3&impact=4)
  const searchParams = useSearchParams();
  const initialHeatCell = useMemo(() => {
    const l = Number(searchParams.get("likelihood"));
    const i = Number(searchParams.get("impact"));
    return l > 0 && i > 0 ? { likelihood: l, impact: i } : null;
  }, [searchParams]);
  const [heatMapMode, setHeatMapMode] = useState<"inherent" | "residual">("residual");
  const [selectedHeatCell, setSelectedHeatCell] = useState<{
    likelihood: number;
    impact: number;
  } | null>(initialHeatCell);

  // Bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [risksRes, summaryRes] = await Promise.all([
        fetch("/api/v1/risks?limit=500&sortBy=riskScoreResidual&sortDir=desc"),
        fetch("/api/v1/risks/dashboard-summary"),
      ]);
      if (!risksRes.ok) throw new Error("Failed to fetch risks");
      const risksJson = await risksRes.json();
      setRisks(risksJson.data ?? []);

      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson.data ?? null);
      }
    } catch {
      setError(true);
      setRisks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRisks();
  }, [fetchRisks]);

  // ---------------------------------------------------------------------------
  // Unique owners for filter
  // ---------------------------------------------------------------------------

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of risks) {
      if (r.ownerId) {
        map.set(r.ownerId, r.ownerName ?? r.ownerEmail ?? r.ownerId);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [risks]);

  // ---------------------------------------------------------------------------
  // Filtered data
  // ---------------------------------------------------------------------------

  const filteredRisks = useMemo(() => {
    let result = risks;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.elementId?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "__all__") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (categoryFilter !== "__all__") {
      result = result.filter((r) => r.riskCategory === categoryFilter);
    }

    if (ownerFilter !== "__all__") {
      result = result.filter((r) => r.ownerId === ownerFilter);
    }

    if (appetiteOnly) {
      result = result.filter((r) => r.riskAppetiteExceeded);
    }

    // Heat map cell filter
    if (selectedHeatCell) {
      const field =
        heatMapMode === "inherent" ? "inherent" : "residual";
      result = result.filter(
        (r) =>
          (field === "inherent"
            ? r.inherentLikelihood
            : r.residualLikelihood) === selectedHeatCell.likelihood &&
          (field === "inherent"
            ? r.inherentImpact
            : r.residualImpact) === selectedHeatCell.impact,
      );
    }

    return result;
  }, [
    risks,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    ownerFilter,
    appetiteOnly,
    selectedHeatCell,
    heatMapMode,
  ]);

  // ---------------------------------------------------------------------------
  // Build heat map cells from risk data
  // ---------------------------------------------------------------------------

  const heatMapCells = useMemo((): HeatMapCell[] => {
    const map = new Map<string, HeatMapCell>();
    for (const r of risks) {
      const likelihood =
        heatMapMode === "inherent" ? r.inherentLikelihood : r.residualLikelihood;
      const impact =
        heatMapMode === "inherent" ? r.inherentImpact : r.residualImpact;
      if (!likelihood || !impact) continue;
      const key = `${likelihood}-${impact}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.risks?.push({ id: r.id, title: r.title });
      } else {
        map.set(key, {
          likelihood,
          impact,
          count: 1,
          risks: [{ id: r.id, title: r.title }],
        });
      }
    }
    return Array.from(map.values());
  }, [risks, heatMapMode]);

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === filteredRisks.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRisks.map((r) => r.id)));
    }
  }, [filteredRisks, selectedRows.size]);

  const handleBulkExport = useCallback(() => {
    const ids = Array.from(selectedRows);
    const exportData = risks.filter((r) => ids.includes(r.id));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risk-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${t("bulk.export")}: ${ids.length}`);
  }, [selectedRows, risks, t]);

  const handleBulkStatusChange = useCallback(
    async (newStatus: RiskStatus) => {
      const ids = Array.from(selectedRows);
      try {
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/v1/risks/${id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            }),
          ),
        );
        toast.success(`${t("bulk.statusChange")}: ${ids.length}`);
        setSelectedRows(new Set());
        await fetchRisks();
      } catch {
        toast.error(t("form.saveError"));
      }
    },
    [selectedRows, fetchRisks, t],
  );

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<RiskRow, unknown>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={
              filteredRisks.length > 0 &&
              selectedRows.size === filteredRisks.length
            }
            onCheckedChange={toggleAll}
            aria-label={t("bulk.selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRows.has(row.original.id)}
            onCheckedChange={() => toggleRow(row.original.id)}
            aria-label={`Select ${row.original.title}`}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "elementId",
        header: t("form.elementId"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-500">
            {row.original.elementId ?? "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/risks/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "riskCategory",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.category")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={categoryBadgeClass(row.original.riskCategory)}
          >
            {t(`category.${row.original.riskCategory}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.status")}</SortableHeader>
        ),
        cell: ({ row }) => <RiskStatusBadge status={row.original.status} />,
      },
      {
        id: "owner",
        header: t("form.owner"),
        cell: ({ row }) => {
          const name = row.original.ownerName ?? row.original.ownerEmail;
          if (!name) return <span className="text-gray-400">\u2014</span>;
          return (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 uppercase">
                {name.charAt(0)}
              </div>
              <span className="text-sm text-gray-700 truncate max-w-[120px]">
                {name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "riskScoreInherent",
        header: ({ column }) => (
          <SortableHeader column={column}>
            {t("heatmap.inherent")}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <RiskScoreBadge score={row.original.riskScoreInherent ?? null} size="sm" />
        ),
      },
      {
        accessorKey: "riskScoreResidual",
        header: ({ column }) => (
          <SortableHeader column={column}>
            {t("heatmap.residual")}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <RiskScoreBadge
              score={row.original.riskScoreResidual ?? null}
              size="sm"
            />
            {row.original.riskAppetiteExceeded && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            )}
          </div>
        ),
      },
      {
        accessorKey: "treatmentStrategy",
        header: t("form.strategy"),
        cell: ({ row }) => {
          const s = row.original.treatmentStrategy;
          if (!s) return <span className="text-gray-400">\u2014</span>;
          return (
            <Badge variant="outline" className={strategyBadgeClass(s)}>
              {t(`treatment.${s}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "reviewDate",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.reviewDate")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span
            className={`text-sm ${reviewDateClass(row.original.reviewDate)}`}
          >
            {formatDate(row.original.reviewDate)}
          </span>
        ),
      },
    ],
    [filteredRisks, selectedRows, toggleAll, toggleRow, t],
  );

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading && risks.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("register")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("title")} &mdash;{" "}
            {summary
              ? `${summary.totalRisks} ${summary.totalRisks === 1 ? "risk" : "risks"}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRisks()}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/risks/new")}>
            <Plus size={16} />
            {t("create")}
          </Button>
        </div>
      </div>

      {/* View Toggle Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => {
          setViewMode(v as "list" | "heatmap");
          setSelectedHeatCell(null);
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <List size={14} />
              {t("view.list")}
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-1.5">
              <LayoutGrid size={14} />
              {t("view.heatMap")}
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("form.searchPlaceholder")}
                className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
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

            {/* Category */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder={t("form.category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {t("filter.allCategories")}
                </SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Owner */}
            {owners.length > 0 && (
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder={t("form.owner")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {t("filter.allOwners")}
                  </SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Appetite toggle */}
            <button
              type="button"
              onClick={() => setAppetiteOnly(!appetiteOnly)}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                appetiteOnly
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <AlertTriangle size={12} />
              {t("appetite.exceeded")}
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRows.size > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
            <span className="text-sm font-medium text-blue-800">
              {selectedRows.size} {t("bulk.selected")}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkExport}
                className="h-7 text-xs"
              >
                <Download size={12} />
                {t("bulk.export")}
              </Button>
              <Select
                onValueChange={(v) =>
                  handleBulkStatusChange(v as RiskStatus)
                }
              >
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue placeholder={t("bulk.statusChange")} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-4 flex flex-col items-center justify-center h-48 text-gray-400">
            <Search size={32} className="mb-2" />
            <p className="text-sm">{t("form.loadError")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fetchRisks()}
            >
              {t("form.retry")}
            </Button>
          </div>
        )}

        {/* LIST VIEW */}
        <TabsContent value="list" className="mt-4">
          {!error && (
            <>
              {filteredRisks.length === 0 && !loading ? (
                <EmptyState
                  hasFilters={
                    debouncedSearch !== "" ||
                    statusFilter !== "__all__" ||
                    categoryFilter !== "__all__" ||
                    appetiteOnly
                  }
                  t={t}
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredRisks}
                  searchKey="title"
                  searchPlaceholder={t("form.searchPlaceholder")}
                  pageSize={15}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* HEAT MAP VIEW */}
        <TabsContent value="heatmap" className="mt-4">
          {!error && (
            <div className="space-y-6">
              {/* Heat map mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHeatMapMode("inherent");
                    setSelectedHeatCell(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    heatMapMode === "inherent"
                      ? "bg-slate-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t("heatmap.inherent")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeatMapMode("residual");
                    setSelectedHeatCell(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    heatMapMode === "residual"
                      ? "bg-slate-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t("heatmap.residual")}
                </button>
              </div>

              {/* Heat Map */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  {t("heatmap.title")}
                </h2>
                <RiskHeatMap
                  cells={heatMapCells}
                  mode={heatMapMode}
                  onCellClick={(cell) =>
                    setSelectedHeatCell(
                      cell
                        ? {
                            likelihood: cell.likelihood,
                            impact: cell.impact,
                          }
                        : null,
                    )
                  }
                  selectedCell={selectedHeatCell}
                />
              </div>

              {/* Filtered risk list below heat map */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {selectedHeatCell
                    ? `${t("heatmap.risksInCell")} (L${selectedHeatCell.likelihood} x I${selectedHeatCell.impact})`
                    : t("register")}
                  {" "}
                  <span className="text-gray-400 font-normal">
                    ({filteredRisks.length})
                  </span>
                </h3>
                {filteredRisks.length === 0 ? (
                  <EmptyState hasFilters={!!selectedHeatCell} t={t} />
                ) : (
                  <div className="space-y-2">
                    {filteredRisks.slice(0, 20).map((r) => (
                      <Link
                        key={r.id}
                        href={`/risks/${r.id}`}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[10px] text-gray-400 shrink-0">
                            {r.elementId}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {r.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`${categoryBadgeClass(r.riskCategory)} text-[10px] shrink-0`}
                          >
                            {t(`category.${r.riskCategory}`)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <RiskStatusBadge status={r.status} />
                          <RiskScoreBadge
                            score={
                              heatMapMode === "inherent"
                                ? r.riskScoreInherent ?? null
                                : r.riskScoreResidual ?? null
                            }
                            size="sm"
                          />
                          {r.riskAppetiteExceeded && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </Link>
                    ))}
                    {filteredRisks.length > 20 && (
                      <p className="text-xs text-gray-400 text-center pt-2">
                        +{filteredRisks.length - 20} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  hasFilters,
  t,
}: {
  hasFilters: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
      <Search size={28} className="text-gray-400 mb-3" />
      <p className="text-sm font-medium text-gray-500">
        {hasFilters ? t("empty.noResults") : t("empty.noRisks")}
      </p>
      {!hasFilters && (
        <p className="text-xs text-gray-400 mt-1">{t("empty.createFirst")}</p>
      )}
    </div>
  );
}
