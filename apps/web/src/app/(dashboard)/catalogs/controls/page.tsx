"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Shield,
  Loader2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ControlCatalog {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  source: string;
  language: string;
  entryCount: number;
}

interface ControlCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId: string | null;
  code: string;
  titleDe: string;
  titleEn: string | null;
  descriptionDe: string | null;
  descriptionEn: string | null;
  implementationDe: string | null;
  implementationEn: string | null;
  level: number;
  controlType: string | null;
  defaultFrequency: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function ControlCatalogBrowserPage() {
  const t = useTranslations("catalogs");

  const [catalogs, setCatalogs] = useState<ControlCatalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<ControlCatalog | null>(null);
  const [entries, setEntries] = useState<ControlCatalogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, ControlCatalogEntry[]>>({});
  const [selectedEntry, setSelectedEntry] = useState<ControlCatalogEntry | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/catalogs/controls?limit=100");
      const json = await res.json();
      setCatalogs(json.data ?? []);
      if (json.data?.length > 0) {
        setSelectedCatalog(json.data[0]);
      }
      setLoading(false);
    })();
  }, []);

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
        `/api/v1/catalogs/controls/${selectedCatalog.id}/entries?${params}`,
      );
      const json = await res.json();
      setEntries(json.data ?? []);
      setLoadingEntries(false);
    })();
  }, [selectedCatalog, search]);

  const loadChildren = useCallback(
    async (entryId: string) => {
      if (!selectedCatalog || childrenMap[entryId]) return;
      const res = await fetch(
        `/api/v1/catalogs/controls/${selectedCatalog.id}/entries?parentEntryId=${entryId}&limit=200`,
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

  const renderEntry = (entry: ControlCatalogEntry, depth: number = 0) => {
    const isExpanded = expandedIds.has(entry.id);
    const children = childrenMap[entry.id] ?? [];
    const hasChildren = entry.level < 3;

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
              {entry.titleDe}
            </span>
            {entry.controlType && (
              <Badge variant="outline" className="text-xs">
                {entry.controlType}
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("controlCatalogs")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("controlsDescription")}</p>
      </div>

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

      <div className="flex gap-6">
        <div className="flex-1 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Shield className="h-4 w-4" />
              {selectedCatalog?.name ?? t("controlCatalogs")}
              {selectedCatalog && (
                <Badge variant="secondary" className="text-xs">
                  {selectedCatalog.entryCount} {t("entry.entries")}
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
                <p className="text-sm font-medium">{selectedEntry.titleDe}</p>
                {selectedEntry.titleEn && (
                  <p className="text-sm text-gray-500">{selectedEntry.titleEn}</p>
                )}
              </div>
              {selectedEntry.descriptionDe && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    {t("entry.description")}
                  </label>
                  <p className="text-sm text-gray-600">
                    {selectedEntry.descriptionDe}
                  </p>
                </div>
              )}
              {selectedEntry.implementationDe && (
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    {t("entry.implementation")}
                  </label>
                  <p className="text-sm text-gray-600">
                    {selectedEntry.implementationDe}
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
                {selectedEntry.controlType && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.controlType")}
                    </label>
                    <p className="text-sm">{selectedEntry.controlType}</p>
                  </div>
                )}
                {selectedEntry.defaultFrequency && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.frequency")}
                    </label>
                    <p className="text-sm">{selectedEntry.defaultFrequency}</p>
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
