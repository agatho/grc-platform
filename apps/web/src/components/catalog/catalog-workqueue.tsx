"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  BookOpen, ChevronDown, ChevronUp, Loader2, Plus, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export function CatalogWorkqueue({ catalogType, createRoute, createParam = "catalogEntryId" }: Props) {
  const t = useTranslations("catalogs");
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogInfo[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      catalogType,
      unassignedOnly: "true",
      limit: "50",
    });
    if (selectedCatalog) params.set("catalogId", selectedCatalog);

    try {
      const res = await fetch(`/api/v1/catalogs/active-entries?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data ?? []);
        setCatalogs(json.catalogs ?? []);
        setTotalEntries(json.totalEntries ?? 0);
        setUnassignedCount(json.unassignedCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [catalogType, selectedCatalog]);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  // Don't show if no active catalogs or all entries processed
  if (!loading && catalogs.length === 0) return null;
  if (!loading && unassignedCount === 0 && entries.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-green-600 shrink-0" />
        <p className="text-sm text-green-800">
          {catalogs.length} {catalogType === "risk" ? "Risikokataloge" : "Kontrollkataloge"} aktiv — alle Einträge bearbeitet
        </p>
      </div>
    );
  }

  const entityLabel = catalogType === "risk" ? "Risiko" : "Kontrolle";

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
              {loading ? "Kataloge werden geladen..." : (
                <>
                  {catalogs.length} aktive {catalogType === "risk" ? "Risikokataloge" : "Kontrollkataloge"}
                  {" · "}
                  <span className="font-bold">{unassignedCount} offene Einträge</span>
                </>
              )}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Aus aktivierten Katalogen — klicken zum Anzeigen
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-blue-600" /> : <ChevronDown size={18} className="text-blue-600" />}
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
                <option value="">Alle Kataloge</option>
                {catalogs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Entry list */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-blue-400" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-blue-700 py-4 text-center">Keine offenen Einträge in diesem Katalog.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-md bg-white border border-blue-100 px-3 py-2.5 hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">{entry.code}</span>
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
                  <Link href={`${createRoute}?${createParam}=${entry.id}&catalogName=${encodeURIComponent(entry.nameDe ?? entry.name)}&catalogCode=${encodeURIComponent(entry.code)}`}>
                    <Button size="sm" variant="default" className="shrink-0 whitespace-nowrap">
                      <Plus size={14} className="mr-1" />
                      {entityLabel} erstellen
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {entries.length > 0 && (
            <p className="text-xs text-blue-600 mt-2 text-center">
              {entries.length} von {unassignedCount} offenen Einträgen angezeigt
            </p>
          )}
        </div>
      )}
    </div>
  );
}
