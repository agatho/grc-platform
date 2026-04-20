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
  Link2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedCatalog, setSelectedCatalog] = useState<RiskCatalog | null>(
    null,
  );
  const [entries, setEntries] = useState<RiskCatalogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<
    Record<string, RiskCatalogEntry[]>
  >({});
  const [selectedEntry, setSelectedEntry] = useState<RiskCatalogEntry | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Catalog activation state
  const [activating, setActivating] = useState(false);
  const [activatedCatalogs, setActivatedCatalogs] = useState<Set<string>>(
    new Set(),
  );

  // Assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignEntityType, setAssignEntityType] = useState("risk");
  const [entityOptions, setEntityOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [assignments, setAssignments] = useState<
    Array<{
      id: string;
      entityType: string;
      entityId: string;
      entry?: { code: string; name: string; catalogName: string } | null;
    }>
  >([]);
  const [assigning, setAssigning] = useState(false);

  const ENTITY_TYPES = [
    { value: "risk", label: "Risk" },
    { value: "control", label: "Control" },
    { value: "asset", label: "Asset" },
    { value: "process", label: "Process" },
    { value: "vendor", label: "Vendor" },
    { value: "finding", label: "Finding" },
  ];

  // Load entities for assignment dialog
  const loadEntities = useCallback(async (type: string, q: string) => {
    setLoadingEntities(true);
    const endpoints: Record<string, string> = {
      risk: "/api/v1/risks",
      control: "/api/v1/controls",
      asset: "/api/v1/assets",
      process: "/api/v1/processes",
      vendor: "/api/v1/vendors",
      finding: "/api/v1/findings",
    };
    const ep = endpoints[type];
    if (!ep) {
      setLoadingEntities(false);
      return;
    }
    const params = new URLSearchParams({ limit: "50" });
    if (q) params.set("search", q);
    const res = await fetch(`${ep}?${params}`);
    if (res.ok) {
      const json = await res.json();
      const items = (json.data ?? []).map((e: any) => ({
        id: e.id,
        title: e.title ?? e.name ?? e.elementId ?? e.id,
      }));
      setEntityOptions(items);
    }
    setLoadingEntities(false);
  }, []);

  // Load existing assignments for selected entry
  const loadAssignments = useCallback(async (entryId: string) => {
    const res = await fetch(
      `/api/v1/catalog-references?catalogEntryId=${entryId}`,
    );
    if (res.ok) {
      const json = await res.json();
      setAssignments(json.data ?? []);
    }
  }, []);

  // Assign entry to entity
  const assignEntry = useCallback(
    async (entityType: string, entityId: string) => {
      if (!selectedEntry) return;
      setAssigning(true);
      const res = await fetch("/api/v1/catalog-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogEntryId: selectedEntry.id,
          entityType,
          entityId,
        }),
      });
      if (res.ok || res.status === 201) {
        await loadAssignments(selectedEntry.id);
      }
      setAssigning(false);
    },
    [selectedEntry, loadAssignments],
  );

  // Remove assignment
  const removeAssignment = useCallback(
    async (refId: string) => {
      await fetch(`/api/v1/catalog-references?id=${refId}`, {
        method: "DELETE",
      });
      if (selectedEntry) await loadAssignments(selectedEntry.id);
    },
    [selectedEntry, loadAssignments],
  );

  // Load assignments when entry is selected
  useEffect(() => {
    if (selectedEntry) loadAssignments(selectedEntry.id);
    else setAssignments([]);
  }, [selectedEntry, loadAssignments]);

  // Load entities when dialog opens or type changes
  useEffect(() => {
    if (assignDialogOpen) loadEntities(assignEntityType, entitySearch);
  }, [assignDialogOpen, assignEntityType, entitySearch, loadEntities]);

  // Activate catalog for current org
  const activateCatalog = useCallback(
    async (catalogId: string, catalogType: string) => {
      setActivating(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const orgId =
          session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId;
        if (!orgId) return;

        const res = await fetch(
          `/api/v1/organizations/${orgId}/active-catalogs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catalogId,
              catalogType: catalogType || "risk",
              enforcementLevel: "recommended",
            }),
          },
        );

        if (res.ok || res.status === 201 || res.status === 409) {
          setActivatedCatalogs((prev) => new Set([...prev, catalogId]));
        }
      } finally {
        setActivating(false);
      }
    },
    [],
  );

  // Fetch catalogs + active status
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/catalogs/risks?limit=100");
      const json = await res.json();
      setCatalogs(json.data ?? []);
      if (json.data?.length > 0) {
        setSelectedCatalog(json.data[0]);
      }

      // Load active catalogs for current org
      try {
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const orgId =
          session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId;
        if (orgId) {
          const activeRes = await fetch(
            `/api/v1/organizations/${orgId}/active-catalogs`,
          );
          if (activeRes.ok) {
            const activeJson = await activeRes.json();
            const activeIds = new Set(
              (activeJson.data ?? []).map((a: any) => a.catalogId),
            );
            setActivatedCatalogs(activeIds as Set<string>);
          }
        }
      } catch {
        /* ignore */
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
            <span className="font-mono text-xs text-gray-500">
              {entry.code}
            </span>
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
        {isExpanded && children.map((child) => renderEntry(child, depth + 1))}
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
          <h1 className="text-2xl font-bold text-gray-900">
            {t("riskCatalogs")}
          </h1>
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

        {/* Activate catalog button */}
        {selectedCatalog &&
          (activatedCatalogs.has(selectedCatalog.id) ? (
            <Badge
              variant="outline"
              className="bg-green-100 text-green-900 border-green-300 text-xs whitespace-nowrap"
            >
              ✓ Aktiviert
            </Badge>
          ) : (
            <Button
              variant="default"
              size="sm"
              disabled={activating}
              onClick={() =>
                activateCatalog(selectedCatalog.id, selectedCatalog.catalogType)
              }
              className="whitespace-nowrap"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Link2 className="h-4 w-4 mr-1" />
              )}
              Katalog aktivieren
            </Button>
          ))}

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
                    <p className="text-sm">
                      {(selectedEntry as any).riskCategory}
                    </p>
                  </div>
                )}
                {(selectedEntry as any).defaultLikelihood != null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.likelihood")}
                    </label>
                    <p className="text-sm">
                      {(selectedEntry as any).defaultLikelihood}
                    </p>
                  </div>
                )}
                {(selectedEntry as any).defaultImpact != null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.impact")}
                    </label>
                    <p className="text-sm">
                      {(selectedEntry as any).defaultImpact}
                    </p>
                  </div>
                )}
              </div>

              {/* Assign button */}
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {t("assign.title")}
                </Button>
              </div>

              {/* Existing assignments */}
              <div className="pt-2 border-t">
                <label className="text-xs font-medium text-gray-500">
                  {t("assign.assignedEntities")} ({assignments.length})
                </label>
                {assignments.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-1">
                    {t("assign.noAssignments")}
                  </p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 text-xs"
                      >
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-1">
                            {a.entityType}
                          </Badge>
                          <span className="text-gray-600">
                            {a.entityId.substring(0, 8)}...
                          </span>
                        </div>
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("assign.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("assign.description")}
            </p>
          </DialogHeader>

          {selectedEntry && (
            <div className="rounded bg-gray-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-gray-500">
                {selectedEntry.code}
              </span>{" "}
              <span className="font-medium">{selectedEntry.name}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                {t("assign.entityType")}
              </label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={assignEntityType}
                onChange={(e) => {
                  setAssignEntityType(e.target.value);
                  setEntitySearch("");
                }}
              >
                {ENTITY_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">
                {t("assign.selectEntity")}
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("assign.searchEntity")}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full rounded-md border pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded border">
              {loadingEntities ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : entityOptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  {t("assign.noEntities")}
                </p>
              ) : (
                entityOptions.map((entity) => {
                  const isAssigned = assignments.some(
                    (a) =>
                      a.entityType === assignEntityType &&
                      a.entityId === entity.id,
                  );
                  return (
                    <div
                      key={entity.id}
                      className="flex items-center justify-between border-b px-3 py-2 last:border-0 hover:bg-gray-50"
                    >
                      <span className="text-sm truncate flex-1 mr-2">
                        {entity.title}
                      </span>
                      {isAssigned ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0"
                        >
                          {t("assign.alreadyAssigned")}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assigning}
                          onClick={() =>
                            assignEntry(assignEntityType, entity.id)
                          }
                          className="shrink-0"
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          {t("assign.assignButton")}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
