"use client";

// Prozesslandkarte — the classic value-chain entry view: three horizontal
// bands (management / core / support) built from level-1 processes.
// Clicking a tile drills into its children (same band logic one level
// down, uncategorized children inherit the parent's band) or opens the
// process detail page when there are no children.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ChevronRight,
  Home,
  Layers,
  Loader2,
  Map as MapIcon,
  Printer,
  Workflow,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { ProcessStatusBadge } from "@/components/process/process-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@grc/ui";
import type { ProcessMapCategory } from "@grc/shared";
import type {
  ProcessMapGroups,
  ProcessMapItem,
} from "@/lib/process-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapParent {
  id: string;
  name: string;
  mapCategory: ProcessMapCategory | null;
  effectiveCategory: ProcessMapCategory | null;
}

interface Crumb {
  id: string;
  name: string;
}

const EMPTY_GROUPS: ProcessMapGroups = {
  management: [],
  core: [],
  support: [],
  unassigned: [],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProcessMapPage() {
  return (
    <ModuleGate moduleKey="bpm">
      <ModuleTabNav />
      <ProcessMapContent />
    </ModuleGate>
  );
}

function ProcessMapContent() {
  const t = useTranslations("processMap");
  const router = useRouter();

  // Drill-in breadcrumb stack — empty = root level (level-1 processes)
  const [stack, setStack] = useState<Crumb[]>([]);
  const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

  const [groups, setGroups] = useState<ProcessMapGroups>(EMPTY_GROUPS);
  const [parent, setParent] = useState<MapParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLevel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = parentId ? `?parentId=${parentId}` : "";
      const res = await fetch(`/api/v1/processes/map${qs}`);
      if (!res.ok) throw new Error(t("loadError"));
      const json = await res.json();
      setGroups(json.data?.groups ?? EMPTY_GROUPS);
      setParent(json.data?.parent ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
      setGroups(EMPTY_GROUPS);
      setParent(null);
    } finally {
      setLoading(false);
    }
  }, [parentId, t]);

  useEffect(() => {
    void fetchLevel();
  }, [fetchLevel]);

  // Tile click: drill in when the process has children, otherwise open
  // the detail page (with ?from= breadcrumb when inside a drill-in).
  const handleTileClick = useCallback(
    (item: ProcessMapItem) => {
      if (item.childCount > 0) {
        setStack((prev) => [...prev, { id: item.id, name: item.name }]);
      } else {
        router.push(
          `/processes/${item.id}${parentId ? `?from=${parentId}` : ""}`,
        );
      }
    },
    [router, parentId],
  );

  const jumpTo = useCallback((index: number) => {
    // index -1 = root
    setStack((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }, []);

  const totalCount =
    groups.management.length +
    groups.core.length +
    groups.support.length +
    groups.unassigned.length;

  return (
    <div className="process-map-print space-y-4">
      {/* Print layout: A4 landscape, chrome hidden */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden; }
          .process-map-print, .process-map-print * { visibility: visible; }
          .process-map-print { position: absolute; left: 0; top: 0; width: 100%; }
          .process-map-no-print { display: none !important; }
          .process-map-band { break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MapIcon className="h-6 w-6 text-indigo-500 process-map-no-print" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 process-map-no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            {t("print")}
          </Button>
        </div>
      </div>

      {/* Breadcrumb (drill-in) */}
      <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => jumpTo(-1)}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
            stack.length === 0
              ? "font-medium text-gray-900"
              : "text-indigo-600 hover:bg-indigo-50",
          )}
        >
          <Home size={14} />
          {t("breadcrumbRoot")}
        </button>
        {stack.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-400" />
            <button
              type="button"
              onClick={() => jumpTo(idx)}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
                idx === stack.length - 1
                  ? "font-medium text-gray-900"
                  : "text-indigo-600 hover:bg-indigo-50",
              )}
            >
              {parent && idx === stack.length - 1 ? parent.name : crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Map */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <Workflow className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            {t("empty.title")}
          </p>
          <p className="mt-1 text-sm text-gray-500">{t("empty.hint")}</p>
          <Link
            href="/processes"
            className="process-map-no-print mt-4 inline-block"
          >
            <Button variant="outline" size="sm">
              {t("empty.goToProcesses")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Management band */}
          <MapBand
            label={t("bands.management")}
            className="border-sky-200 bg-sky-50/60"
            labelClassName="text-sky-800"
          >
            {groups.management.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {groups.management.map((item) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-sky-300 bg-white hover:border-sky-400"
                  />
                ))}
              </div>
            )}
          </MapBand>

          {/* Core band — value-chain chevrons, left to right */}
          <MapBand
            label={t("bands.core")}
            className="border-indigo-200 bg-indigo-50/60"
            labelClassName="text-indigo-800"
          >
            {groups.core.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap items-stretch gap-y-3 -space-x-2">
                {groups.core.map((item) => (
                  <ChevronTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                  />
                ))}
              </div>
            )}
          </MapBand>

          {/* Support band */}
          <MapBand
            label={t("bands.support")}
            className="border-emerald-200 bg-emerald-50/60"
            labelClassName="text-emerald-800"
          >
            {groups.support.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {groups.support.map((item) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-emerald-300 bg-white hover:border-emerald-400"
                  />
                ))}
              </div>
            )}
          </MapBand>

          {/* Unassigned strip — subtle, only when something is uncategorized */}
          {groups.unassigned.length > 0 && (
            <MapBand
              label={t("bands.unassigned")}
              className="border-dashed border-gray-300 bg-gray-50/60"
              labelClassName="text-gray-500"
            >
              <div className="flex flex-wrap gap-3">
                {groups.unassigned.map((item) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-gray-300 bg-white hover:border-gray-400"
                  />
                ))}
              </div>
            </MapBand>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Band + tiles
// ---------------------------------------------------------------------------

function MapBand({
  label,
  className,
  labelClassName,
  children,
}: {
  label: string;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("process-map-band rounded-lg border p-4", className)}
    >
      <h2
        className={cn(
          "mb-3 text-xs font-semibold uppercase tracking-wide",
          labelClassName,
        )}
      >
        {label}
      </h2>
      {children}
    </section>
  );
}

function BandEmpty({ text }: { text: string }) {
  return <p className="py-2 text-sm italic text-gray-400">{text}</p>;
}

function MapTile({
  item,
  onClick,
  subprocessLabel,
  className,
}: {
  item: ProcessMapItem;
  onClick: (item: ProcessMapItem) => void;
  subprocessLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={cn(
        "w-56 rounded-md border p-3 text-left shadow-sm transition-colors",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm font-medium text-gray-900 leading-snug"
          title={item.name}
        >
          {item.name}
        </span>
        <ProcessStatusBadge status={item.status} size="sm" showDot={false} />
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <Layers size={12} />
        {subprocessLabel}
      </div>
    </button>
  );
}

/** Core-process tile in value-chain chevron shape (CSS clip-path). */
function ChevronTile({
  item,
  onClick,
  subprocessLabel,
}: {
  item: ProcessMapItem;
  onClick: (item: ProcessMapItem) => void;
  subprocessLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="min-w-[200px] flex-1 bg-indigo-600 py-3 pl-8 pr-7 text-left text-white transition-colors hover:bg-indigo-700"
      style={{
        clipPath:
          "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-semibold leading-snug"
          title={item.name}
        >
          {item.name}
        </span>
        <ProcessStatusBadge status={item.status} size="sm" showDot={false} />
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-indigo-200">
        <Layers size={12} />
        {subprocessLabel}
      </div>
    </button>
  );
}
