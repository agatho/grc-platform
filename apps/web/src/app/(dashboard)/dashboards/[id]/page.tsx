"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import {
  Pencil,
  Eye,
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
// @ts-expect-error -- react-grid-layout has no bundled types; @types/react-grid-layout may lag behind
import { Responsive, WidthProvider } from "react-grid-layout";
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

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardViewPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dashboardId = params.id as string;
  const isEditFromUrl = searchParams.get("edit") === "true";

  const [dashboard, setDashboard] = useState<DashboardWithWidgets | null>(null);
  const [widgetDefinitions, setWidgetDefinitions] = useState<WidgetDefinitionRecord[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, { status: string; data?: unknown; error?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(isEditFromUrl);
  const [isSaving, setIsSaving] = useState(false);

  // Edit mode state
  const [editLayout, setEditLayout] = useState<Layout[]>([]);
  const [editWidgets, setEditWidgets] = useState<(CustomDashboardWidgetRecord & { definition: WidgetDefinitionRecord })[]>([]);
  const [configWidget, setConfigWidget] = useState<{
    widget: CustomDashboardWidgetRecord & { definition: WidgetDefinitionRecord };
    isNew: boolean;
  } | null>(null);

  // ──────────────────────────────────────────────────
  // Fetch dashboard + widget definitions
  // ──────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashRes, defsRes] = await Promise.all([
        fetch(`/api/v1/dashboards/${dashboardId}`),
        fetch("/api/v1/dashboards/widget-definitions"),
      ]);

      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        setDashboard(dashJson.data);

        const widgets = dashJson.data.widgets ?? [];
        setEditWidgets(widgets);
        setEditLayout(
          widgets.map((w: CustomDashboardWidgetRecord & { definition: WidgetDefinitionRecord }) => {
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
      }

      if (defsRes.ok) {
        const defsJson = await defsRes.json();
        setWidgetDefinitions(defsJson.data ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId]);

  const fetchWidgetData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const res = await fetch(`/api/v1/dashboards/${dashboardId}/data`);
      if (res.ok) {
        const json: BatchWidgetDataResponse = await res.json();
        setWidgetData(json.widgetData ?? {});
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (dashboard && !isEditMode) {
      fetchWidgetData();
    }
  }, [dashboard, isEditMode, fetchWidgetData]);

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
      fetchDashboard();
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    setIsEditMode(false);
    router.replace(`/dashboards/${dashboardId}`);
    fetchDashboard();
  }

  async function handleToggleFavorite() {
    if (!dashboard) return;
    await fetch(`/api/v1/dashboards/${dashboardId}/favorite`, {
      method: "PUT",
    });
    fetchDashboard();
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

  async function handleUpdateWidgetConfig(widgetId: string, config: WidgetConfig) {
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
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboards")}>
          {t("backToList")}
        </Button>
      </div>
    );
  }

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
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboards")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-xs text-muted-foreground">{dashboard.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                >
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
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: displayLayout }}
            breakpoints={{ lg: 1200, md: 768, sm: 480 }}
            cols={{ lg: 12, md: 8, sm: 4 }}
            rowHeight={80}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            draggableHandle=".drag-handle"
            onLayoutChange={(layout: Layout[]) => {
              if (isEditMode) handleLayoutChange(layout);
            }}
            compactType="vertical"
            useCSSTransforms
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
                    error={wd?.status === "rejected" ? (wd.error ?? "Fehler") : undefined}
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
