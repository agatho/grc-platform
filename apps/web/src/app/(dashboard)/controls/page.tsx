"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Search,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { CatalogWorkqueue } from "@/components/catalog/catalog-workqueue";
import { ControlStatusBadge } from "@/components/control/control-status-badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ControlType,
  ControlFrequency,
  ControlStatus,
  AutomationLevel,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlRow {
  id: string;
  title: string;
  controlType: ControlType;
  frequency: ControlFrequency;
  automationLevel: AutomationLevel;
  status: ControlStatus;
  assertions: string[];
  ownerId?: string;
  ownerName?: string;
  department?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: ControlStatus[] = [
  "designed",
  "implemented",
  "effective",
  "ineffective",
  "retired",
];

const TYPES: ControlType[] = ["preventive", "detective", "corrective"];

const FREQUENCIES: ControlFrequency[] = [
  "event_driven",
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
  "ad_hoc",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadgeClass(type: ControlType): string {
  const map: Record<ControlType, string> = {
    preventive: "bg-blue-100 text-blue-800 border-blue-200",
    detective: "bg-amber-100 text-amber-800 border-amber-200",
    corrective: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return map[type] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function automationBadgeClass(level: AutomationLevel): string {
  const map: Record<AutomationLevel, string> = {
    manual: "bg-gray-100 text-gray-700 border-gray-200",
    semi_automated: "bg-cyan-100 text-cyan-800 border-cyan-200",
    fully_automated: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return map[level] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ControlsPage() {
  return (
    <ModuleGate moduleKey="ics">
      <ModuleTabNav />
      <ControlsPageInner />
    </ModuleGate>
  );
}

function ControlsPageInner() {
  const t = useTranslations("controls");
  const router = useRouter();

  const [controls, setControls] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("__all__");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchControls = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/controls?limit=500&sortBy=title&sortDir=asc");
      if (!res.ok) throw new Error("Failed to fetch controls");
      const json = await res.json();
      setControls(json.data ?? []);
    } catch {
      setError(true);
      setControls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchControls();
  }, [fetchControls]);

  const filteredControls = useMemo(() => {
    let result = controls;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "__all__") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (typeFilter !== "__all__") {
      result = result.filter((c) => c.controlType === typeFilter);
    }
    if (frequencyFilter !== "__all__") {
      result = result.filter((c) => c.frequency === frequencyFilter);
    }
    return result;
  }, [controls, debouncedSearch, statusFilter, typeFilter, frequencyFilter]);

  const columns: ColumnDef<ControlRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/controls/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "controlType",
        header: t("form.type"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={typeBadgeClass(row.original.controlType)}
          >
            {t(`type.${row.original.controlType}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "frequency",
        header: t("form.frequency"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">
            {t(`frequency.${row.original.frequency}`)}
          </span>
        ),
      },
      {
        accessorKey: "automationLevel",
        header: t("form.automation"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={automationBadgeClass(row.original.automationLevel)}
          >
            {t(`automation.${row.original.automationLevel}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.status")}</SortableHeader>
        ),
        cell: ({ row }) => <ControlStatusBadge status={row.original.status} />,
      },
      {
        id: "owner",
        header: t("form.owner"),
        cell: ({ row }) => {
          const name = row.original.ownerName;
          if (!name) return <span className="text-gray-400">{"\u2014"}</span>;
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
        accessorKey: "lastTestedAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.lastTested")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {formatDate(row.original.lastTestedAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  if (loading && controls.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Catalog Workqueue */}
      <CatalogWorkqueue catalogType="control" createRoute="/controls/new" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("register")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("title")} &mdash; {filteredControls.length} {t("register")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchControls()}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/controls/new")}>
            <Plus size={16} />
            {t("create")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

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

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("form.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allTypes")}</SelectItem>
            {TYPES.map((tt) => (
              <SelectItem key={tt} value={tt}>
                {t(`type.${tt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder={t("form.frequency")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allFrequencies")}</SelectItem>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f} value={f}>
                {t(`frequency.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <ShieldCheck size={32} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => fetchControls()}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <>
          {filteredControls.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Search size={28} className="text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {debouncedSearch || statusFilter !== "__all__" || typeFilter !== "__all__"
                  ? t("empty.noResults")
                  : t("empty.noControls")}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredControls}
              searchKey="title"
              searchPlaceholder={t("searchPlaceholder")}
              pageSize={15}
            />
          )}
        </>
      )}
    </div>
  );
}
