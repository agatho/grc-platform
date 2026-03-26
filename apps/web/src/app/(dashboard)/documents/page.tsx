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
  FileText,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
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
import type { DocumentCategory, DocumentStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentRow {
  id: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  currentVersion: number;
  ownerName?: string;
  publishedAt?: string;
  acknowledgmentPct?: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: DocumentCategory[] = [
  "policy",
  "procedure",
  "guideline",
  "template",
  "record",
  "tom",
  "dpa",
  "bcp",
  "soa",
  "other",
];

const STATUSES: DocumentStatus[] = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
  "expired",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryBadgeClass(category: DocumentCategory): string {
  const map: Record<DocumentCategory, string> = {
    policy: "bg-indigo-100 text-indigo-800 border-indigo-200",
    procedure: "bg-blue-100 text-blue-800 border-blue-200",
    guideline: "bg-cyan-100 text-cyan-800 border-cyan-200",
    template: "bg-violet-100 text-violet-800 border-violet-200",
    record: "bg-amber-100 text-amber-800 border-amber-200",
    tom: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dpa: "bg-teal-100 text-teal-800 border-teal-200",
    bcp: "bg-orange-100 text-orange-800 border-orange-200",
    soa: "bg-red-100 text-red-800 border-red-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return map[category] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function statusBadgeClass(status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    in_review: "bg-blue-100 text-blue-800 border-blue-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    published: "bg-green-100 text-green-800 border-green-200",
    archived: "bg-slate-200 text-slate-600 border-slate-300",
    expired: "bg-red-100 text-red-800 border-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocumentsPage() {
  return (
    <ModuleGate moduleKey="dms">
      <DocumentsPageInner />
    </ModuleGate>
  );
}

function DocumentsPageInner() {
  const t = useTranslations("documents");
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/documents?limit=500&sortBy=title&sortDir=asc");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setDocuments(json.data ?? []);
    } catch {
      setError(true);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const filtered = useMemo(() => {
    let result = documents;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "__all__") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (categoryFilter !== "__all__") {
      result = result.filter((d) => d.category === categoryFilter);
    }
    return result;
  }, [documents, debouncedSearch, statusFilter, categoryFilter]);

  const columns: ColumnDef<DocumentRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/documents/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "category",
        header: t("form.category"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={categoryBadgeClass(row.original.category)}
          >
            {t(`category.${row.original.category}`)}
          </Badge>
        ),
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
        accessorKey: "currentVersion",
        header: t("form.version"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-600">
            v{row.original.currentVersion}
          </span>
        ),
      },
      {
        accessorKey: "publishedAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("form.publishedAt")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {formatDate(row.original.publishedAt)}
          </span>
        ),
      },
      {
        id: "acknowledgment",
        header: t("form.acknowledgment"),
        cell: ({ row }) => {
          const pct = row.original.acknowledgmentPct;
          if (pct == null) return <span className="text-gray-400">{"\u2014"}</span>;
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">{pct}%</span>
            </div>
          );
        },
      },
    ],
    [t],
  );

  if (loading && documents.length === 0) {
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
            {t("title")} &mdash; {filtered.length} {t("itemCount")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDocuments()}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/documents/new")}>
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

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("form.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`category.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <FileText size={32} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchDocuments()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <>
          {filtered.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Search size={28} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {debouncedSearch || statusFilter !== "__all__" || categoryFilter !== "__all__"
                  ? t("empty.noResults")
                  : t("empty.noDocuments")}
              </p>
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
        </>
      )}
    </div>
  );
}
