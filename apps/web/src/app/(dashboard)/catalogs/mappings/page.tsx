"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Loader2,
  X,
  ArrowRight,
  GitCompareArrows,
  ChevronDown,
  ChevronRight,
  Shield,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Catalog {
  id: string;
  name: string;
  source: string;
  version: string | null;
  catalogType: string;
}

interface CatalogEntry {
  id: string;
  code: string;
  name: string;
  level: number;
}

interface MappingEntry {
  sourceEntry: {
    code: string;
    name: string;
    catalogName: string;
    catalogSource: string;
    catalogId: string;
  };
  targetEntry: {
    code: string;
    name: string;
    catalogName: string;
    catalogSource: string;
    catalogId: string;
  };
  relationship: string;
  confidence: number;
}

interface GroupedMappings {
  catalogName: string;
  catalogSource: string;
  entries: MappingEntry[];
}

const relationshipConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  equivalent: {
    label: "Equivalent",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
  },
  partial_overlap: {
    label: "Partial Overlap",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  subset: {
    label: "Subset",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  superset: {
    label: "Superset",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
  },
  related: {
    label: "Related",
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
  },
};

function getRelationshipStyle(relationship: string) {
  return (
    relationshipConfig[relationship] ?? {
      label: relationship,
      color: "text-gray-700",
      bgColor: "bg-gray-50 border-gray-200",
    }
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-green-500"
      : value >= 75
        ? "bg-yellow-500"
        : "bg-orange-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500">{value}%</span>
    </div>
  );
}

export default function CrossFrameworkMappingsPage() {
  const t = useTranslations("catalogs");

  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [entrySearch, setEntrySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch all catalogs
  useEffect(() => {
    (async () => {
      try {
        const [controlRes, riskRes] = await Promise.all([
          fetch("/api/v1/catalogs/controls?limit=50"),
          fetch("/api/v1/catalogs/risks?limit=50"),
        ]);
        const controlJson = await controlRes.json();
        const riskJson = await riskRes.json();
        const allCatalogs = [
          ...(controlJson.data ?? []),
          ...(riskJson.data ?? []),
        ];
        setCatalogs(allCatalogs);
        if (allCatalogs.length > 0) {
          setSelectedCatalog(allCatalogs[0]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch entries when catalog changes
  useEffect(() => {
    if (!selectedCatalog) return;
    setLoadingEntries(true);
    setSelectedEntry(null);
    setMappings([]);
    setExpandedGroups(new Set());

    const catalogType = selectedCatalog.catalogType;
    const base =
      catalogType === "risk"
        ? `/api/v1/catalogs/risks/${selectedCatalog.id}/entries`
        : `/api/v1/catalogs/controls/${selectedCatalog.id}/entries`;

    (async () => {
      try {
        const params = new URLSearchParams({ limit: "300" });
        if (entrySearch) params.set("search", entrySearch);
        const res = await fetch(`${base}?${params}`);
        const json = await res.json();
        setEntries(json.data ?? []);
      } catch {
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [selectedCatalog, entrySearch]);

  // Fetch mappings when entry changes
  const fetchMappings = useCallback(async (entryId: string) => {
    setLoadingMappings(true);
    try {
      const res = await fetch(
        `/api/v1/catalogs/mappings?entryId=${entryId}`,
      );
      const json = await res.json();
      setMappings(json.data ?? []);
      // Expand all groups by default
      const groups = new Set<string>();
      for (const m of json.data ?? []) {
        groups.add(m.targetEntry.catalogName);
        groups.add(m.sourceEntry.catalogName);
      }
      setExpandedGroups(groups);
    } catch {
      setMappings([]);
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEntry) {
      fetchMappings(selectedEntry.id);
    }
  }, [selectedEntry, fetchMappings]);

  // Group mappings by target catalog (normalize: if the selected entry is target, swap)
  const groupedMappings: GroupedMappings[] = (() => {
    if (!selectedEntry || mappings.length === 0) return [];

    const groups: Record<string, GroupedMappings> = {};

    for (const m of mappings) {
      // Determine which side is the "other" framework
      const isSource = m.sourceEntry.catalogId === selectedCatalog?.id;
      const otherEntry = isSource ? m.targetEntry : m.sourceEntry;

      const key = otherEntry.catalogName;
      if (!groups[key]) {
        groups[key] = {
          catalogName: otherEntry.catalogName,
          catalogSource: otherEntry.catalogSource,
          entries: [],
        };
      }
      groups[key].entries.push(m);
    }

    return Object.values(groups).sort((a, b) =>
      a.catalogName.localeCompare(b.catalogName),
    );
  })();

  const totalFrameworks = groupedMappings.length;
  const totalMappings = mappings.length;

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <GitCompareArrows className="h-7 w-7 text-indigo-600" />
            {t("mappings.frameworkCoverage")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("mappings.frameworkCoverageDescription")}
          </p>
        </div>
      </div>

      {/* Value proposition banner */}
      {selectedEntry && totalMappings > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-medium text-indigo-900">
              {t("mappings.implementOnce")}
            </p>
            <p className="mt-0.5 text-sm text-indigo-700">
              {t("mappings.implementOnceDetail", {
                control: `${selectedEntry.code} - ${selectedEntry.name}`,
                requirements: totalMappings,
                frameworks: totalFrameworks,
              })}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left panel: Catalog + Entry selector */}
        <div className="w-[420px] shrink-0 space-y-3">
          {/* Catalog dropdown */}
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={selectedCatalog?.id ?? ""}
            onChange={(e) => {
              const cat = catalogs.find((c) => c.id === e.target.value);
              if (cat) setSelectedCatalog(cat);
            }}
          >
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.source})
              </option>
            ))}
          </select>

          {/* Entry search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("mappings.searchEntries")}
              value={entrySearch}
              onChange={(e) => setEntrySearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {entrySearch && (
              <button
                onClick={() => setEntrySearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Entry list */}
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Shield className="h-4 w-4" />
                {selectedCatalog?.name ?? t("mappings.selectCatalog")}
                <Badge variant="secondary" className="text-xs">
                  {entries.length}
                </Badge>
              </h3>
            </div>
            <div className="p-1">
              {loadingEntries ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {t("mappings.noEntries")}
                </p>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                      selectedEntry?.id === entry.id
                        ? "bg-indigo-50 ring-1 ring-indigo-200"
                        : ""
                    }`}
                  >
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {entry.code}
                    </span>
                    <span className="truncate text-sm text-gray-900">
                      {entry.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right panel: Mapping results */}
        <div className="min-w-0 flex-1">
          {!selectedEntry ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12">
              <div className="text-center">
                <GitCompareArrows className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-600">
                  {t("mappings.selectEntryToViewMappings")}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {t("mappings.selectEntryToViewMappingsDetail")}
                </p>
              </div>
            </div>
          ) : loadingMappings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12">
              <div className="text-center">
                <Info className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-600">
                  {t("mappings.noMappingsFound")}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {t("mappings.noMappingsFoundDetail")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary header */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {selectedEntry.code} — {selectedEntry.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t("mappings.mappingSummary", {
                      mappings: totalMappings,
                      frameworks: totalFrameworks,
                    })}
                  </p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">
                      {totalMappings}
                    </p>
                    <p className="text-xs text-gray-500">{t("mappings.mappings")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">
                      {totalFrameworks}
                    </p>
                    <p className="text-xs text-gray-500">{t("mappings.frameworks")}</p>
                  </div>
                </div>
              </div>

              {/* Grouped mapping results */}
              {groupedMappings.map((group) => {
                const isExpanded = expandedGroups.has(group.catalogName);
                return (
                  <div
                    key={group.catalogName}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.catalogName)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {group.catalogName}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {group.catalogSource}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {group.entries.length}{" "}
                        {group.entries.length === 1
                          ? t("mappings.mapping")
                          : t("mappings.mappings")}
                      </Badge>
                    </button>

                    {/* Group entries */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {group.entries.map((m, idx) => {
                          const isSource =
                            m.sourceEntry.catalogId === selectedCatalog?.id;
                          const otherEntry = isSource
                            ? m.targetEntry
                            : m.sourceEntry;
                          const style = getRelationshipStyle(m.relationship);

                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-b-0"
                            >
                              {/* Source (selected entry) */}
                              <div className="w-36 shrink-0">
                                <span className="font-mono text-xs text-gray-500">
                                  {selectedEntry.code}
                                </span>
                              </div>

                              {/* Arrow + relationship */}
                              <div className="flex shrink-0 flex-col items-center gap-1">
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bgColor} ${style.color}`}
                                >
                                  {style.label}
                                </span>
                              </div>

                              {/* Target entry */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0 font-mono text-xs font-medium text-gray-700">
                                    {otherEntry.code}
                                  </span>
                                  <span className="truncate text-sm text-gray-900">
                                    {otherEntry.name}
                                  </span>
                                </div>
                              </div>

                              {/* Confidence */}
                              <div className="shrink-0">
                                <ConfidenceBar value={m.confidence} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
