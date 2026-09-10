"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import type { UnvalidatedJson } from "@/lib/unvalidated-json";
import { fetchAllPages } from "@/lib/api-client";

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

interface EntityOption {
  id: string;
  title: string;
}

interface CatalogAssignment {
  id: string;
  entityType: string;
  entityId: string;
  entry?: { code: string; name: string; catalogName: string } | null;
}

const ENTITY_ENDPOINTS: Record<string, string> = {
  risk: "/api/v1/risks",
  control: "/api/v1/controls",
  asset: "/api/v1/assets",
  process: "/api/v1/processes",
  vendor: "/api/v1/vendors",
  finding: "/api/v1/findings",
};

export default function RiskCatalogBrowserPage() {
  const t = useTranslations("catalogs");

  const [catalogs, setCatalogs] = useState<RiskCatalog[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<RiskCatalog | null>(
    null,
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<
    Record<string, RiskCatalogEntry[]>
  >({});
  const [selectedEntry, setSelectedEntry] = useState<RiskCatalogEntry | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Catalog activation state
  const [activating, setActivating] = useState(false);
  const [activatedCatalogs, setActivatedCatalogs] = useState<Set<string>>(
    new Set(),
  );

  // Assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignEntityType, setAssignEntityType] = useState("risk");
  const [entitySearch, setEntitySearch] = useState("");
  const [assigning, setAssigning] = useState(false);

  const ENTITY_TYPES = [
    { value: "risk", label: "Risk" },
    { value: "control", label: "Control" },
    { value: "asset", label: "Asset" },
    { value: "process", label: "Process" },
    { value: "vendor", label: "Vendor" },
    { value: "finding", label: "Finding" },
  ];

  // [OP-245 · Gestalt A] Die Kandidatenliste des Zuweisungsdialogs kam aus
  // einem Effekt, der bei offenem Dialog `loadEntities` rief und Ergebnis
  // samt Ladezustand synchron zurückschrieb. Jetzt eine Abfrage über
  // `@tanstack/react-query` (Muster aus Welle 7b, `catalogs/objects/page.tsx`,
  // gleiche Gestalt wie `catalogs/controls`): `enabled` ersetzt das
  // `if (assignDialogOpen)`, Typ und Suchbegriff stehen im Schlüssel. Eine
  // nicht-ok-Antwort liefert wie vorher keine Einträge.
  const { data: entityOptions = [], isPending: entitiesPending } = useQuery<
    EntityOption[]
  >({
    queryKey: [
      "catalogs",
      "assignable-entities",
      assignEntityType,
      entitySearch,
    ],
    enabled: assignDialogOpen,
    queryFn: async () => {
      const ep = ENTITY_ENDPOINTS[assignEntityType];
      if (!ep) return [];
      const params = new URLSearchParams({ limit: "50" });
      if (entitySearch) params.set("search", entitySearch);
      const res = await fetch(`${ep}?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []).map((e: UnvalidatedJson) => ({
        id: e.id,
        title: e.title ?? e.name ?? e.elementId ?? e.id,
      })) as EntityOption[];
    },
  });
  // `isPending` bleibt bei abgeschalteter Abfrage wahr, deshalb steht der
  // Dialogzustand auch in der Ableitung des Ladezustands.
  const loadingEntities = assignDialogOpen && entitiesPending;

  // [OP-245 · Gestalt A] Bestehende Zuweisungen des gewählten Eintrags —
  // vorher `if (selectedEntry) loadAssignments(id) else setAssignments([])`
  // im Effekt. Ohne gewählten Eintrag ist die Abfrage abgeschaltet und die
  // Liste leer; `loadAssignments` bleibt als dünne Hülle für die Aufrufer
  // nach Zuweisen und Entfernen.
  const selectedEntryId = selectedEntry?.id ?? null;
  const { data: assignments = [], refetch: refetchAssignments } = useQuery<
    CatalogAssignment[]
  >({
    queryKey: ["catalogs", "assignments", selectedEntryId],
    enabled: selectedEntryId !== null,
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/catalog-references?catalogEntryId=${selectedEntryId}`,
      );
      // [ARCTOS-FULL-2026-08-31 · OP-249] siehe catalogs/controls — die leere
      // Liste bleibt der richtige Ausgang, das Schweigen war der Fehler.
      if (!res.ok) {
        toast.error(t("assign.loadError"));
        return [];
      }
      const json = await res.json();
      return (json.data ?? []) as CatalogAssignment[];
    },
  });

  const loadAssignments = useCallback(async () => {
    await refetchAssignments();
  }, [refetchAssignments]);

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
        await loadAssignments();
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
      if (selectedEntry) await loadAssignments();
    },
    [selectedEntry, loadAssignments],
  );

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
              (activeJson.data ?? []).map((a: UnvalidatedJson) => a.catalogId),
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

  // [OP-245 · Gestalt A] Wurzeleinträge des gewählten Katalogs (mit
  // Suchbegriff) — vorher ein Effekt, der `loadingEntries` synchron setzte und
  // dann abrief. Katalog-Id und Suchbegriff stehen im Schlüssel; die
  // OP-050-Fehlerbehandlung (Konsole + leere Liste) bleibt unverändert. Das
  // Zurücksetzen von Aufklapp-, Kinder- und Auswahlzustand, das derselbe
  // Effekt bei Katalog- oder Suchwechsel erledigte, geschieht jetzt in den
  // Ereignisbehandlern, die den Wechsel auslösen (`resetBrowserState`).
  const selectedCatalogId = selectedCatalog?.id ?? null;
  const { data: entries = [], isPending: entriesPending } = useQuery<
    RiskCatalogEntry[]
  >({
    queryKey: ["catalogs", "risks", selectedCatalogId, "entries", search],
    enabled: selectedCatalogId !== null,
    queryFn: async () => {
      // [ARCTOS-FULL-2026-08-31 · OP-050] siehe catalogs/controls —
      // dasselbe Muster, derselbe Ausgang.
      const params: Record<string, string> = { parentEntryId: "root" };
      if (search) params.search = search;
      try {
        return await fetchAllPages<RiskCatalogEntry>(
          `/api/v1/catalogs/risks/${selectedCatalogId}/entries`,
          { params },
        );
      } catch (err) {
        console.error("catalogs/risks: Einträge nicht geladen", err);
        return [];
      }
    },
  });
  const loadingEntries = selectedCatalogId !== null && entriesPending;

  const resetBrowserState = useCallback(() => {
    setExpandedIds(new Set());
    setChildrenMap({});
    setSelectedEntry(null);
  }, []);

  // Load children for an entry
  const loadChildren = useCallback(
    async (entryId: string) => {
      if (!selectedCatalog || childrenMap[entryId]) return;
      // [ARCTOS-FULL-2026-08-31 · OP-050] dito für die Unterebene.
      try {
        const children = await fetchAllPages<RiskCatalogEntry>(
          `/api/v1/catalogs/risks/${selectedCatalog.id}/entries`,
          { params: { parentEntryId: entryId } },
        );
        setChildrenMap((prev) => ({ ...prev, [entryId]: children }));
      } catch (err) {
        console.error("catalogs/risks: Unterebene nicht geladen", err);
      }
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
            {(entry as UnvalidatedJson).riskCategory && (
              <Badge variant="outline" className="text-xs">
                {(entry as UnvalidatedJson).riskCategory}
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
            if (cat) {
              resetBrowserState();
              setSelectedCatalog(cat);
            }
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
            onChange={(e) => {
              resetBrowserState();
              setSearch(e.target.value);
            }}
            className="w-full rounded-md border border-gray-300 pl-9 pr-8 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => {
                resetBrowserState();
                setSearch("");
              }}
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
                {(selectedEntry as UnvalidatedJson).riskCategory && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.category")}
                    </label>
                    <p className="text-sm">
                      {(selectedEntry as UnvalidatedJson).riskCategory}
                    </p>
                  </div>
                )}
                {(selectedEntry as UnvalidatedJson).defaultLikelihood !=
                  null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.likelihood")}
                    </label>
                    <p className="text-sm">
                      {(selectedEntry as UnvalidatedJson).defaultLikelihood}
                    </p>
                  </div>
                )}
                {(selectedEntry as UnvalidatedJson).defaultImpact != null && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">
                      {t("entry.impact")}
                    </label>
                    <p className="text-sm">
                      {(selectedEntry as UnvalidatedJson).defaultImpact}
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
