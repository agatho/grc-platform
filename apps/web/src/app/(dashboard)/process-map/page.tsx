"use client";

// Prozesslandkarte — the classic value-chain entry view: three horizontal
// bands (management / core / support) built from level-1 processes.
// Clicking a tile drills into its children (same band logic one level
// down, uncategorized children inherit the parent's band) or opens the
// process detail page when there are no children.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
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
import { moveItemInBand } from "@/lib/process-map";
import type {
  ProcessMapBand,
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

const ALL_BANDS: ProcessMapBand[] = [
  "management",
  "core",
  "support",
  "unassigned",
];

/** Up/down controls handed to a tile in manual-sort mode. */
interface TileSortControls {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  upLabel: string;
  downLabel: string;
}

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
  const { data: session } = useSession();

  // Drill-in breadcrumb stack — empty = root level (level-1 processes)
  const [stack, setStack] = useState<Crumb[]>([]);
  const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

  const [groups, setGroups] = useState<ProcessMapGroups>(EMPTY_GROUPS);
  const [parent, setParent] = useState<MapParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual sort mode (0374) — draft holds the unsaved band order.
  const [sortMode, setSortMode] = useState(false);
  const [draft, setDraft] = useState<ProcessMapGroups | null>(null);
  const [savingSort, setSavingSort] = useState(false);

  // Same edit gate as the process PUT route (admin, process_owner).
  const canSort = useMemo(() => {
    const roles = session?.user?.roles ?? [];
    return roles.some((r) => r.role === "admin" || r.role === "process_owner");
  }, [session]);

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

  // Leaving the current drill level discards any unsaved sort draft.
  useEffect(() => {
    setSortMode(false);
    setDraft(null);
  }, [parentId]);

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

  const startSort = useCallback(() => {
    setDraft(groups);
    setSortMode(true);
  }, [groups]);

  const cancelSort = useCallback(() => {
    setSortMode(false);
    setDraft(null);
  }, []);

  const moveDraftItem = useCallback(
    (band: ProcessMapBand, index: number, direction: "up" | "down") => {
      setDraft((prev) =>
        prev
          ? { ...prev, [band]: moveItemInBand(prev[band], index, direction) }
          : prev,
      );
    },
    [],
  );

  const saveSort = useCallback(async () => {
    if (!draft) return;
    setSavingSort(true);
    setError(null);
    try {
      for (const band of ALL_BANDS) {
        const before = groups[band].map((i) => i.id).join(",");
        const after = draft[band].map((i) => i.id);
        if (after.length < 2 || after.join(",") === before) continue;
        const res = await fetch("/api/v1/processes/map/reorder", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ category: band, orderedIds: after }),
        });
        if (!res.ok) throw new Error(t("sort.saveError"));
      }
      setSortMode(false);
      setDraft(null);
      await fetchLevel();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sort.saveError"));
    } finally {
      setSavingSort(false);
    }
  }, [draft, groups, fetchLevel, t]);

  const sortControlsFor = useCallback(
    (
      band: ProcessMapBand,
      index: number,
      length: number,
    ): TileSortControls => ({
      canUp: index > 0,
      canDown: index < length - 1,
      onUp: () => moveDraftItem(band, index, "up"),
      onDown: () => moveDraftItem(band, index, "down"),
      upLabel: t("sort.moveUp"),
      downLabel: t("sort.moveDown"),
    }),
    [moveDraftItem, t],
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

  // In sort mode the unsaved draft order is rendered instead.
  const shown = sortMode && draft ? draft : groups;

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
          {canSort && totalCount > 0 && !sortMode && (
            <Button variant="outline" size="sm" onClick={startSort}>
              <ArrowDownUp size={16} />
              {t("sort.start")}
            </Button>
          )}
          {sortMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelSort}
                disabled={savingSort}
              >
                {t("sort.cancel")}
              </Button>
              <Button size="sm" onClick={saveSort} disabled={savingSort}>
                {savingSort && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("sort.save")}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={sortMode}
          >
            <Printer size={16} />
            {t("print")}
          </Button>
        </div>
      </div>

      {/* Sort-mode hint */}
      {sortMode && (
        <p className="process-map-no-print rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {t("sort.hint")}
        </p>
      )}

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
            {shown.management.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {shown.management.map((item, idx) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-sky-300 bg-white hover:border-sky-400"
                    sort={
                      sortMode
                        ? sortControlsFor(
                            "management",
                            idx,
                            shown.management.length,
                          )
                        : undefined
                    }
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
            {shown.core.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap items-stretch gap-y-3 -space-x-2">
                {shown.core.map((item, idx) => (
                  <ChevronTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    sort={
                      sortMode
                        ? sortControlsFor("core", idx, shown.core.length)
                        : undefined
                    }
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
            {shown.support.length === 0 ? (
              <BandEmpty text={t("bandEmpty")} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {shown.support.map((item, idx) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-emerald-300 bg-white hover:border-emerald-400"
                    sort={
                      sortMode
                        ? sortControlsFor("support", idx, shown.support.length)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </MapBand>

          {/* Unassigned strip — subtle, only when something is uncategorized */}
          {shown.unassigned.length > 0 && (
            <MapBand
              label={t("bands.unassigned")}
              className="border-dashed border-gray-300 bg-gray-50/60"
              labelClassName="text-gray-500"
            >
              <div className="flex flex-wrap gap-3">
                {shown.unassigned.map((item, idx) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    onClick={handleTileClick}
                    subprocessLabel={t("tile.subprocesses", {
                      count: item.childCount,
                    })}
                    className="border-gray-300 bg-white hover:border-gray-400"
                    sort={
                      sortMode
                        ? sortControlsFor(
                            "unassigned",
                            idx,
                            shown.unassigned.length,
                          )
                        : undefined
                    }
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

/** Up/down arrow pair shown on every tile in manual-sort mode. */
function SortArrows({
  sort,
  buttonClassName,
}: {
  sort: TileSortControls;
  buttonClassName?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={sort.onUp}
        disabled={!sort.canUp}
        aria-label={sort.upLabel}
        title={sort.upLabel}
        className={cn(
          "rounded border p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
          buttonClassName ??
            "border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
        )}
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        onClick={sort.onDown}
        disabled={!sort.canDown}
        aria-label={sort.downLabel}
        title={sort.downLabel}
        className={cn(
          "rounded border p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
          buttonClassName ??
            "border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
        )}
      >
        <ArrowDown size={14} />
      </button>
    </span>
  );
}

function MapTile({
  item,
  onClick,
  subprocessLabel,
  className,
  sort,
}: {
  item: ProcessMapItem;
  onClick: (item: ProcessMapItem) => void;
  subprocessLabel: string;
  className?: string;
  sort?: TileSortControls;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm font-medium text-gray-900 leading-snug"
          title={item.name}
        >
          {item.name}
        </span>
        <ProcessStatusBadge status={item.status} size="sm" showDot={false} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Layers size={12} />
          {subprocessLabel}
        </span>
        {sort && <SortArrows sort={sort} />}
      </div>
    </>
  );

  // Sort mode: a <div> instead of a <button> — the arrows are the only
  // interactive elements (no nested buttons, drill-in disabled).
  if (sort) {
    return (
      <div
        className={cn(
          "w-56 rounded-md border p-3 text-left shadow-sm",
          className,
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={cn(
        "w-56 rounded-md border p-3 text-left shadow-sm transition-colors",
        className,
      )}
    >
      {inner}
    </button>
  );
}

/** Core-process tile in value-chain chevron shape (CSS clip-path). */
function ChevronTile({
  item,
  onClick,
  subprocessLabel,
  sort,
}: {
  item: ProcessMapItem;
  onClick: (item: ProcessMapItem) => void;
  subprocessLabel: string;
  sort?: TileSortControls;
}) {
  const chevronStyle = {
    clipPath:
      "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
    printColorAdjust: "exact",
    WebkitPrintColorAdjust: "exact",
  } as const;

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold leading-snug" title={item.name}>
          {item.name}
        </span>
        <ProcessStatusBadge status={item.status} size="sm" showDot={false} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-indigo-200">
        <span className="flex items-center gap-1">
          <Layers size={12} />
          {subprocessLabel}
        </span>
        {sort && (
          <SortArrows
            sort={sort}
            buttonClassName="border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-400"
          />
        )}
      </div>
    </>
  );

  // Sort mode: <div> host so the arrow buttons are not nested in a button.
  if (sort) {
    return (
      <div
        className="min-w-[200px] flex-1 bg-indigo-600 py-3 pl-8 pr-7 text-left text-white"
        style={chevronStyle}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="min-w-[200px] flex-1 bg-indigo-600 py-3 pl-8 pr-7 text-left text-white transition-colors hover:bg-indigo-700"
      style={chevronStyle}
    >
      {inner}
    </button>
  );
}
