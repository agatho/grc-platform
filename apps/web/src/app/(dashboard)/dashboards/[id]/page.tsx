"use client";

import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import {
  Pencil,
  Star,
  StarOff,
  FileDown,
  Copy,
  Save,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}
import { DashboardWidgetFrame } from "@/components/dashboard/dashboard-widget-frame";
import { WidgetCatalogSidebar } from "@/components/dashboard/widget-catalog-sidebar";
import { WidgetConfigPanel } from "@/components/dashboard/widget-config-panel";
import type {
  DashboardWithWidgets,
  WidgetDefinitionRecord,
  WidgetConfig,
  CustomDashboardWidgetRecord,
  LayoutItem,
  BatchWidgetDataResponse,
} from "@grc/shared";

type WidgetWithDefinition = CustomDashboardWidgetRecord & {
  definition: WidgetDefinitionRecord;
};

type WidgetDataMap = Record<
  string,
  { status: string; data?: unknown; error?: string }
>;

// [OP-245 · Gestalt A] Zwei Befunde: der Abruf des Dashboards schrieb neben
// Ergebnis und Ladezustand auch den BEARBEITUNGSZUSTAND (`editWidgets`,
// `editLayout`) synchron im Effekt zurueck, und ein zweiter Effekt holte die
// Widget-Daten, sobald das Dashboard da und der Bearbeitungsmodus aus war.
// Beide Abrufe liegen jetzt in `@tanstack/react-query` (Muster aus Welle 7b,
// `processes/[id]/ropa/page.tsx`): der Serverstand ist die SAAT des Editors,
// nicht sein Inhalt. Der Editor ist deshalb in ein eigenes Bauteil gewandert,
// das mit dem geladenen Stand EINGEHAENGT wird — React setzt den Anfangswert
// beim Einhaengen, ein spiegelnder Effekt entfaellt. Der zweite Abruf haengt
// ueber `enabled` an derselben Bedingung wie vorher.
export default function DashboardViewPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dashboardId = params.id as string;
  const isEditFromUrl = searchParams.get("edit") === "true";
  const [isEditMode, setIsEditMode] = useState(isEditFromUrl);

  // ──────────────────────────────────────────────────
  // Fetch dashboard + widget definitions
  // ──────────────────────────────────────────────────

  const {
    data: pageData,
    isPending: isLoading,
    refetch: refetchDashboard,
  } = useQuery<{
    dashboard: DashboardWithWidgets | null;
    widgetDefinitions: WidgetDefinitionRecord[];
  }>({
    queryKey: ["dashboards", dashboardId],
    queryFn: async () => {
      const [dashRes, defsRes] = await Promise.all([
        fetch(`/api/v1/dashboards/${dashboardId}`),
        fetch("/api/v1/dashboards/widget-definitions"),
      ]);

      let dashboard: DashboardWithWidgets | null = null;
      let widgetDefinitions: WidgetDefinitionRecord[] = [];
      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        dashboard = dashJson.data;
      }
      if (defsRes.ok) {
        const defsJson = await defsRes.json();
        widgetDefinitions = defsJson.data ?? [];
      }
      return { dashboard, widgetDefinitions };
    },
  });
  const dashboard = pageData?.dashboard ?? null;
  const widgetDefinitions = pageData?.widgetDefinitions ?? [];

  // Widget-Daten: wie vorher nur, wenn das Dashboard da und der
  // Bearbeitungsmodus aus ist. `isDataLoading` ist `isFetching`, weil der
  // alte Wert bei JEDEM Abruf wahr wurde (auch beim erneuten Versuch).
  const {
    data: widgetData = {},
    isFetching: isDataLoading,
    refetch: refetchWidgetData,
  } = useQuery<WidgetDataMap>({
    queryKey: ["dashboards", dashboardId, "data"],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dashboards/${dashboardId}/data`);
      if (!res.ok) return {};
      const json: BatchWidgetDataResponse = await res.json();
      return json.widgetData ?? {};
    },
    enabled: dashboard !== null && !isEditMode,
  });

  const fetchWidgetData = useCallback(async () => {
    await refetchWidgetData();
  }, [refetchWidgetData]);

  // Der Schluessel wird nach Speichern/Verwerfen erhoeht, damit der Editor
  // mit dem frischen Serverstand neu eingehaengt wird — nicht bei jedem
  // Hintergrundabruf.
  const [seedVersion, setSeedVersion] = useState(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>{t("dashboardNotFound")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboards")}
        >
          {t("backToList")}
        </Button>
      </div>
    );
  }

  return (
    <DashboardView
      key={seedVersion}
      dashboardId={dashboardId}
      dashboard={dashboard}
      widgetDefinitions={widgetDefinitions}
      widgetData={widgetData}
      isDataLoading={isDataLoading}
      fetchWidgetData={fetchWidgetData}
      isEditMode={isEditMode}
      setIsEditMode={setIsEditMode}
      onReload={async () => {
        await refetchDashboard();
        await refetchWidgetData();
        setSeedVersion((v) => v + 1);
      }}
      onRefetchDashboard={async () => {
        await refetchDashboard();
      }}
    />
  );
}

function DashboardView({
  dashboardId,
  dashboard,
  widgetDefinitions,
  widgetData,
  isDataLoading,
  fetchWidgetData,
  isEditMode,
  setIsEditMode,
  onReload,
  onRefetchDashboard,
}: {
  dashboardId: string;
  dashboard: DashboardWithWidgets;
  widgetDefinitions: WidgetDefinitionRecord[];
  widgetData: WidgetDataMap;
  isDataLoading: boolean;
  fetchWidgetData: () => Promise<void>;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  onReload: () => Promise<void>;
  onRefetchDashboard: () => Promise<void>;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  // [OP-234] react-grid-layout 2 replaced the `WidthProvider` HOC with this
  // hook: the grid needs an explicit `width`, measured on the wrapping div.
  const {
    width: gridWidth,
    containerRef: gridContainerRef,
    mounted: gridMounted,
  } = useContainerWidth();

  const [isSaving, setIsSaving] = useState(false);

  // Edit mode state — seeded from the loaded dashboard on mount
  const [editWidgets, setEditWidgets] = useState<WidgetWithDefinition[]>(
    () => (dashboard.widgets ?? []) as WidgetWithDefinition[],
  );
  const [editLayout, setEditLayout] = useState<Layout[]>(() =>
    ((dashboard.widgets ?? []) as WidgetWithDefinition[]).map((w) => {
      const pos = w.positionJson as unknown as Record<string, number>;
      return {
        i: w.id,
        x: pos.x ?? 0,
        y: pos.y ?? 0,
        w: pos.w ?? 4,
        h: pos.h ?? 3,
        minW: w.definition.minWidth ?? 2,
        minH: w.definition.minHeight ?? 2,
        maxW: w.definition.maxWidth ?? 12,
        maxH: w.definition.maxHeight ?? 8,
      };
    }),
  );
  const [configWidget, setConfigWidget] = useState<{
    widget: WidgetWithDefinition;
    isNew: boolean;
  } | null>(null);

  // ──────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────

  async function handleSave() {
    if (!dashboard) return;
    setIsSaving(true);
    try {
      // Save layout to dashboard
      const layoutItems: LayoutItem[] = editLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: l.minW,
        minH: l.minH,
      }));

      await fetch(`/api/v1/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutJson: layoutItems }),
      });

      // Update each widget's position
      for (const widget of editWidgets) {
        const layoutItem = editLayout.find((l) => l.i === widget.id);
        if (layoutItem) {
          await fetch(
            `/api/v1/dashboards/${dashboardId}/widgets/${widget.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionJson: {
                  x: layoutItem.x,
                  y: layoutItem.y,
                  w: layoutItem.w,
                  h: layoutItem.h,
                },
                configJson: widget.configJson,
              }),
            },
          );
        }
      }

      setIsEditMode(false);
      router.replace(`/dashboards/${dashboardId}`);
      await onReload();
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    setIsEditMode(false);
    router.replace(`/dashboards/${dashboardId}`);
    void onReload();
  }

  async function handleToggleFavorite() {
    if (!dashboard) return;
    await fetch(`/api/v1/dashboards/${dashboardId}/favorite`, {
      method: "PUT",
    });
    void onRefetchDashboard();
  }

  async function handleExportPdf() {
    const res = await fetch(`/api/v1/dashboards/${dashboardId}/export-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "a4_landscape" }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-${dashboardId}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleDuplicate() {
    if (!dashboard) return;
    const res = await fetch(`/api/v1/dashboards/${dashboardId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${dashboard.name} (Kopie)` }),
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/dashboards/${json.data.id}?edit=true`);
    }
  }

  async function handleAddWidget(definition: WidgetDefinitionRecord) {
    // Find the next available position
    const maxY = editLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0);

    const res = await fetch(`/api/v1/dashboards/${dashboardId}/widgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widgetDefinitionId: definition.id,
        positionJson: {
          x: 0,
          y: maxY,
          w: Math.max(definition.minWidth, 4),
          h: Math.max(definition.minHeight, 3),
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const newWidget = {
        ...json.data,
        definition,
      };
      setEditWidgets((prev) => [...prev, newWidget]);
      setEditLayout((prev) => [
        ...prev,
        {
          i: json.data.id,
          x: 0,
          y: maxY,
          w: Math.max(definition.minWidth, 4),
          h: Math.max(definition.minHeight, 3),
          minW: definition.minWidth,
          minH: definition.minHeight,
          maxW: definition.maxWidth ?? 12,
          maxH: definition.maxHeight ?? 8,
        },
      ]);
    }
  }

  async function handleRemoveWidget(widgetId: string) {
    await fetch(`/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: "DELETE",
    });
    setEditWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setEditLayout((prev) => prev.filter((l) => l.i !== widgetId));
    setConfigWidget(null);
  }

  async function handleUpdateWidgetConfig(
    widgetId: string,
    config: WidgetConfig,
  ) {
    await fetch(`/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configJson: config }),
    });
    setEditWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, configJson: config } : w)),
    );
    setConfigWidget(null);
  }

  function handleLayoutChange(newLayout: Layout[]) {
    setEditLayout(newLayout as Layout[]);
  }

  // ──────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────

  const displayWidgets = isEditMode ? editWidgets : (dashboard.widgets ?? []);
  const displayLayout = isEditMode
    ? editLayout
    : displayWidgets.map((w) => {
        const pos = w.positionJson as unknown as Record<string, number>;
        return {
          i: w.id,
          x: pos.x ?? 0,
          y: pos.y ?? 0,
          w: pos.w ?? 4,
          h: pos.h ?? 3,
          minW: w.definition.minWidth ?? 2,
          minH: w.definition.minHeight ?? 2,
        };
      });

  return (
    <div className="flex h-full">
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboards")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-xs text-muted-foreground">
                  {dashboard.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button variant="outline" size="sm" onClick={handleDiscard}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {t("discard")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("save")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleFavorite}
                >
                  {dashboard.isFavorite ? (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf}>
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  {t("exportPdf")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDuplicate}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t("duplicate")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsEditMode(true);
                    router.replace(`/dashboards/${dashboardId}?edit=true`);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {t("edit")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Grid Area */}
        {displayWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-muted-foreground">
            <p className="text-sm">{t("noWidgets")}</p>
            {!isEditMode && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setIsEditMode(true);
                  router.replace(`/dashboards/${dashboardId}?edit=true`);
                }}
              >
                <Pencil className="mr-1 h-3 w-3" />
                {t("addWidgets")}
              </Button>
            )}
          </div>
        ) : (
          <div ref={gridContainerRef}>
            {gridMounted && (
              <ResponsiveGridLayout
                width={gridWidth}
                className="layout"
                layouts={{ lg: displayLayout }}
                breakpoints={{ lg: 1200, md: 768, sm: 480 }}
                cols={{ lg: 12, md: 8, sm: 4 }}
                rowHeight={80}
                dragConfig={{ enabled: isEditMode, handle: ".drag-handle" }}
                resizeConfig={{ enabled: isEditMode }}
                compactor={verticalCompactor}
                onLayoutChange={(layout) => {
                  if (isEditMode) handleLayoutChange([...layout]);
                }}
              >
                {displayWidgets.map((widget) => {
                  const wd = widgetData[widget.id];
                  const wConfig = widget.configJson as WidgetConfig;

                  return (
                    <div key={widget.id}>
                      <DashboardWidgetFrame
                        widgetId={widget.id}
                        definitionKey={widget.definition.key}
                        widgetType={widget.definition.type}
                        title={widget.definition.nameDe}
                        config={wConfig}
                        data={wd?.data}
                        isLoading={isDataLoading && !wd}
                        error={
                          wd?.status === "rejected"
                            ? (wd.error ?? "Fehler")
                            : undefined
                        }
                        isEditMode={isEditMode}
                        onConfigure={() =>
                          setConfigWidget({ widget, isNew: false })
                        }
                        onRemove={() => handleRemoveWidget(widget.id)}
                        onRetry={fetchWidgetData}
                      />
                    </div>
                  );
                })}
              </ResponsiveGridLayout>
            )}
          </div>
        )}
      </div>

      {/* Widget Catalog Sidebar (edit mode only) */}
      {isEditMode && (
        <WidgetCatalogSidebar
          definitions={widgetDefinitions}
          onAddWidget={handleAddWidget}
        />
      )}

      {/* Widget Config Panel */}
      <WidgetConfigPanel
        definition={configWidget?.widget.definition ?? null}
        existingConfig={
          configWidget
            ? (configWidget.widget.configJson as WidgetConfig)
            : undefined
        }
        open={configWidget !== null}
        onClose={() => setConfigWidget(null)}
        onApply={(config) => {
          if (configWidget) {
            handleUpdateWidgetConfig(configWidget.widget.id, config);
          }
        }}
        onRemove={
          configWidget
            ? () => handleRemoveWidget(configWidget.widget.id)
            : undefined
        }
      />
    </div>
  );
}
