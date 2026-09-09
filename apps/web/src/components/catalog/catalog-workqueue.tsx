"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CatalogEntry {
  id: string;
  catalogId: string;
  code: string;
  name: string;
  nameDe: string | null;
  description: string | null;
  descriptionDe: string | null;
  level: number;
}

interface CatalogInfo {
  id: string;
  name: string;
  source: string;
  catalogType: string;
}

interface Props {
  /** "risk" or "control" */
  catalogType: "risk" | "control";
  /** Route for creating new entity, e.g. "/risks/new" */
  createRoute: string;
  /** Query param name for pre-filling, e.g. "catalogEntryId" */
  createParam?: string;
}

export function CatalogWorkqueue({
  catalogType,
  createRoute,
  createParam = "catalogEntryId",
}: Props) {
  const t = useTranslations("catalogs");
  const [expanded, setExpanded] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Katalogtyp und Filter stehen im
  // Schlüssel; eine nicht-ok-Antwort liefert wie vorher leere Werte. Das nie
  // gelesene `_totalEntries` entfiel.
  const { data: bundle, isPending: loading } = useQuery<{
    entries: CatalogEntry[];
    catalogs: CatalogInfo[];
    unassignedCount: number;
  }>({
    queryKey: ["catalogs", "active-entries", catalogType, selectedCatalog],
    queryFn: async () => {
      const params = new URLSearchParams({
        catalogType,
        unassignedOnly: "true",
        limit: "50",
      });
      if (selectedCatalog) params.set("catalogId", selectedCatalog);

      const res = await fetch(`/api/v1/catalogs/active-entries?${params}`);
      if (!res.ok) return { entries: [], catalogs: [], unassignedCount: 0 };
      const json = await res.json();
      return {
        entries: (json.data ?? []) as CatalogEntry[],
        catalogs: (json.catalogs ?? []) as CatalogInfo[],
        unassignedCount: (json.unassignedCount ?? 0) as number,
      };
    },
  });
  const entries = bundle?.entries ?? [];
  const catalogs = bundle?.catalogs ?? [];
  const unassignedCount = bundle?.unassignedCount ?? 0;

  // Don't show if no active catalogs or all entries processed
  if (!loading && catalogs.length === 0) return null;
  if (!loading && unassignedCount === 0 && entries.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-green-600 shrink-0" />
        <p className="text-sm text-green-800">
          {catalogs.length}{" "}
          {catalogType === "risk" ? "Risikokataloge" : "Kontrollkataloge"} aktiv
          — alle Einträge bearbeitet
        </p>
      </div>
    );
  }

  const createLabel =
    catalogType === "risk"
      ? t("workqueue.createRisk")
      : t("workqueue.createControl");

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              {loading ? (
                t("workqueue.loading")
              ) : (
                <>
                  {catalogType === "risk"
                    ? t("workqueue.summaryRisk", { count: catalogs.length })
                    : t("workqueue.summaryControl", { count: catalogs.length })}
                  {" · "}
                  <span className="font-bold">
                    {t("workqueue.openEntries", { count: unassignedCount })}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              {t("workqueue.hint")}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-blue-600" />
        ) : (
          <ChevronDown size={18} className="text-blue-600" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-blue-200 px-4 py-3">
          {/* Catalog filter */}
          {catalogs.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedCatalog}
                onChange={(e) => setSelectedCatalog(e.target.value)}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">{t("workqueue.allCatalogs")}</option>
                {catalogs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Entry list */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-blue-600" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-blue-700 py-4 text-center">
              {t("workqueue.empty")}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-md bg-white border border-blue-100 px-3 py-2.5 hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">
                        {entry.code}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {entry.nameDe ?? entry.name}
                      </span>
                    </div>
                    {(entry.descriptionDe ?? entry.description) && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {entry.descriptionDe ?? entry.description}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`${createRoute}?${createParam}=${entry.id}&catalogName=${encodeURIComponent(entry.nameDe ?? entry.name)}&catalogCode=${encodeURIComponent(entry.code)}`}
                  >
                    <Button
                      size="sm"
                      variant="default"
                      className="shrink-0 whitespace-nowrap"
                    >
                      <Plus size={14} className="mr-1" />
                      {createLabel}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {entries.length > 0 && (
            <p className="text-xs text-blue-600 mt-2 text-center">
              {t("workqueue.shown", {
                shown: entries.length,
                total: unassignedCount,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
