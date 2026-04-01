"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Loader2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RiskCatalog {
  id: string;
  name: string;
  description: string | null;
  catalogType: string;
  version: string | null;
  source: string;
  targetModules: string[];
}

interface RiskCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId: string | null;
  code: string;
  name: string;
  description: string | null;
  level: number;
  sortOrder: number;
  status: string;
}

export default function RiskCatalogBrowserPage() {
  const t = useTranslations("catalogs");

  const [catalogs, setCatalogs] = useState<RiskCatalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<RiskCatalog | null>(null);
  const [entries, setEntries] = useState<RiskCatalogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, RiskCatalogEntry[]>>({});
  const [selectedEntry, setSelectedEntry] = useState<RiskCatalogEntry | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Fetch catalogs
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/catalogs/risks?limit=100");
      const json = await res.json();
      setCatalogs(json.data ?? []);
      if (json.data?.length > 0) {
        setSelectedCatalog(json.data[0]);
      }
      setLoading(false);
    })();
  }, []);

  // Fetch root entries when catalog changes
  useEffect(() => {
    if (!selectedCatalog) return;
    setLoadingEntries(true);
    setExpandedIds(new Set());
    setChildrenMap({});
    setSelectedEntry(null);

    (async () => {
      const params = new URLSearchParams({
        parentEntryId: "root",
        limit: "200",
      });
      if (search) params.set("search", search);
      const res = await fetch(
        `/api/v1/catalogs/risks/${selectedCatalog.id}/entries?${params}`,
      );
      const json = await res.json();
      setEntries(json.data ?? []);
      setLoadingEntries(false);
    })();
  }, [selectedCatalog, search]);

  // Load children for an entry
  const loadChildren = useCallback(
    async (entryId: string) => {
      if (!selectedCatalog || childrenMap[entryId]) return;
      const res = await fetch(
        `/api/v1/catalogs/risks/${selectedCatalog.id}/entries?parentEntryId=${entryId}&limit=200`,
      );
      const json = await res.json();
      setChildrenMap((prev) => ({ ...prev, [entryId]: json.data ?? [] }));
    },
    [selectedCatalog, childrenMap],
  );

  const toggleExpand = useCallback(
    async (entryId: string) => {
      const next = new Set(expandedIds);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
        await loadChildren(entryId);
      }
      setExpandedIds(next);
    },
    [expandedIds, loadChildren],
  );

  const renderEntry = (entry: RiskCatalogEntry, depth: number = 0) => {
    const isExpanded = expandedIds.has(entry.id);
    const children = childrenMap[entry.id] ?? [];
    const hasChildren = entry.level < 3; // assume max 3 levels

    return (
      <div key={entry.id}>
        <div
          className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 hover:bg-gray-50 ${
            selectedEntry?.id === entry.id ? "bg-blue-50" : ""
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(entry.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <button
            onClick={() => setSelectedEntry(entry)}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <span className="font-mono text-xs text-gray-500">{entry.code}</span>
            <span className="text-sm font-medium text-gray-900">
              {entry.name}
            </span>
            {(entry as any).riskCategory && (
              <Badge variant="outline" className="text-xs">
                {(entry as any).riskCategory}
              </Badge>
            )}
          </button>
        </div>
        {isExpanded &&
          children.map((child) => renderEntry(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("riskCatalogs")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("risksDescription")}</p>
        </div>
      </div>

      {/* Catalog selector */}
      <div className="flex items-center gap-4">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={selectedCatalog?.id ?? ""}
          onChange={(e) => {
            const cat = catalogs.find((c) => c.id === e.target.value);
            if (cat) setSelectedCatalog(cat);
          }}
        >
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.source} v{c.version})
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-9 pr-8 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tree + Detail side panel */}
      <div className="flex gap-6">
        {/* Tree browser */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <BookOpen className="h-4 w-4" />
              {selectedCatalog?.name ?? t("riskCatalogs")}
              {selectedCatalog && (
                <Badge variant="secondary" className="text-xs">
                  {entries.length} {t("entry.entries")}
                </Badge>
              )}
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-2">
            {loadingEntries ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {t("noEntries")}
              </p>
            ) : (
              entries.map((entry) => renderEntry(entry, 0))
            )}
          </div>
        </div>

        {/* Side panel */}
        {selectedEntry && (
          <div className="w-96 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  {t("entry.details")}
                </h3>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="rounded p-1 hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("entry.code")}
                </label>
                <p className="font-mono text-sm">{selectedEntry.code}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("entry.title")}
                </label>
                <p className="text-sm font-medium">{selectedEntry.name}</p>
              </div>
              {selectedEntry.description && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    {t("entry.description")}
                  </label>
                  <p className="text-sm text-gray-600">
                    {selectedEntry.description}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    {t("entry.level")}
                  </label>
                  <p className="text-sm">{selectedEntry.level}</p>
                </div>
                {(selectedEntry as any).riskCategory && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.category")}
                    </label>
                    <p className="text-sm">{(selectedEntry as any).riskCategory}</p>
                  </div>
                )}
                {(selectedEntry as any).defaultLikelihood != null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.likelihood")}
                    </label>
                    <p className="text-sm">{(selectedEntry as any).defaultLikelihood}</p>
                  </div>
                )}
                {(selectedEntry as any).defaultImpact != null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.impact")}
                    </label>
                    <p className="text-sm">{(selectedEntry as any).defaultImpact}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
