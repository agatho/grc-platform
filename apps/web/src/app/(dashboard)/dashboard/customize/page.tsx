"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  GripVertical,
  Save,
  X,
  RotateCcw,
  Eye,
  EyeOff,
  Building,
  Maximize,
  Plus,
  Grid3X3,
  CheckSquare,
  Calendar,
  Shield,
  AlertTriangle,
  Activity,
  BarChart3,
  Bell,
  Lock,
  FileText,
  MessageSquare,
  Server,
} from "lucide-react";
import type { WidgetPosition } from "@grc/shared";

// ---------------------------------------------------------------------------
// Widget Registry
// ---------------------------------------------------------------------------

interface WidgetDef {
  id: string;
  nameKey: string;
  icon: typeof Grid3X3;
  defaultW: number;
  defaultH: number;
}

const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "risk-heatmap",
    nameKey: "widgetRiskHeatmap",
    icon: Grid3X3,
    defaultW: 2,
    defaultH: 2,
  },
  {
    id: "task-list",
    nameKey: "widgetTaskList",
    icon: CheckSquare,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: "audit-timeline",
    nameKey: "widgetAuditTimeline",
    icon: Calendar,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: "compliance-status",
    nameKey: "widgetComplianceStatus",
    icon: Shield,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: "incident-feed",
    nameKey: "widgetIncidentFeed",
    icon: AlertTriangle,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: "control-health",
    nameKey: "widgetControlHealth",
    icon: Activity,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: "kpi-summary",
    nameKey: "widgetKpiSummary",
    icon: BarChart3,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: "notifications",
    nameKey: "widgetNotifications",
    icon: Bell,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: "data-breach-status",
    nameKey: "widgetDataBreach",
    icon: Lock,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: "document-recent",
    nameKey: "widgetDocumentRecent",
    icon: FileText,
    defaultW: 2,
    defaultH: 1,
  },
  {
    id: "wb-statistics",
    nameKey: "widgetWbStatistics",
    icon: MessageSquare,
    defaultW: 1,
    defaultH: 1,
  },
  {
    id: "asset-overview",
    nameKey: "widgetAssetOverview",
    icon: Server,
    defaultW: 1,
    defaultH: 1,
  },
];

const SIZE_OPTIONS = [
  { label: "1x1", w: 1, h: 1 },
  { label: "1x2", w: 2, h: 1 },
  { label: "2x1", w: 1, h: 2 },
  { label: "2x2", w: 2, h: 2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardCustomizePage() {
  const { data: session } = useSession();
  const t = useTranslations("branding");

  const [layout, setLayout] = useState<WidgetPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [sizeMenuOpen, setSizeMenuOpen] = useState<string | null>(null);

  const orgId =
    session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId ?? null;

  // Fetch layout on mount
  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch("/api/v1/users/me/dashboard-layout");
        if (res.ok) {
          const { data } = await res.json();
          setLayout(data.layoutJson as WidgetPosition[]);
        }
      } catch {
        // Use empty layout
      } finally {
        setIsLoading(false);
      }
    }
    fetchLayout();
  }, []);

  const visibleWidgets = layout.filter((w) => w.visible);
  const hiddenWidgetIds = layout
    .filter((w) => !w.visible)
    .map((w) => w.widgetId);

  // Widgets not yet in layout at all
  const unaddedWidgets = WIDGET_REGISTRY.filter(
    (wd) => !layout.some((l) => l.widgetId === wd.id),
  );

  const toggleVisibility = useCallback(
    (widgetId: string) => {
      // Check minimum constraint
      const currentVisible = layout.filter(
        (w) => w.visible && w.widgetId !== widgetId,
      );
      const widget = layout.find((w) => w.widgetId === widgetId);

      if (widget?.visible && currentVisible.length === 0) {
        return; // Cannot hide last widget
      }

      setLayout((prev) =>
        prev.map((w) =>
          w.widgetId === widgetId ? { ...w, visible: !w.visible } : w,
        ),
      );
      setHasChanges(true);
    },
    [layout],
  );

  const addWidget = useCallback(
    (widgetDef: WidgetDef) => {
      const maxY = layout.reduce((max, w) => Math.max(max, w.y + w.h), 0);
      setLayout((prev) => [
        ...prev,
        {
          widgetId: widgetDef.id,
          x: 0,
          y: maxY,
          w: widgetDef.defaultW,
          h: widgetDef.defaultH,
          visible: true,
        },
      ]);
      setHasChanges(true);
    },
    [layout],
  );

  const changeSize = useCallback((widgetId: string, w: number, h: number) => {
    setLayout((prev) =>
      prev.map((widget) =>
        widget.widgetId === widgetId ? { ...widget, w, h } : widget,
      ),
    );
    setSizeMenuOpen(null);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/users/me/dashboard-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutJson: layout }),
      });
      if (res.ok) {
        setHasChanges(false);
      }
    } catch {
      // Save failed
    } finally {
      setIsSaving(false);
    }
  }, [layout]);

  const handleSetOrgDefault = useCallback(async () => {
    if (!orgId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/v1/organizations/${orgId}/dashboard-layout/default`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutJson: layout }),
      });
    } catch {
      // Save failed
    } finally {
      setIsSaving(false);
    }
  }, [orgId, layout]);

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/users/me/dashboard-layout");
      if (res.ok) {
        const { data } = await res.json();
        setLayout(data.layoutJson as WidgetPosition[]);
        setHasChanges(false);
      }
    } catch {
      // Reset failed
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("customizeDashboard")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("customizeDashboardDesc")}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <GripVertical className="h-4 w-4" />
          <span>{t("editorHint")}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWidgetPanel(!showWidgetPanel)}
            className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            {t("addWidget")}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            <RotateCcw className="h-4 w-4" />
            {t("resetLayout")}
          </button>
          <button
            onClick={handleSetOrgDefault}
            className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Building className="h-4 w-4" />
            {t("setOrgDefault")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("saving") : t("saveLayout")}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Widget Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-4">
            {visibleWidgets.map((widget) => {
              const def = WIDGET_REGISTRY.find(
                (wd) => wd.id === widget.widgetId,
              );
              if (!def) return null;
              const Icon = def.icon;

              return (
                <div
                  key={widget.widgetId}
                  className="relative rounded-lg border-2 border-dashed border-gray-300 bg-white p-4 transition hover:border-blue-400"
                  style={{
                    gridColumn: `span ${Math.min(widget.w, 4)}`,
                    gridRow: `span ${widget.h}`,
                    minHeight: widget.h * 100,
                  }}
                >
                  {/* Drag handle */}
                  <div className="absolute left-2 top-2 cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Widget content (dimmed in edit mode) */}
                  <div className="flex h-full flex-col items-center justify-center opacity-70">
                    <Icon className="h-8 w-8 text-gray-400" />
                    <span className="mt-2 text-sm font-medium text-gray-600">
                      {t(def.nameKey)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {widget.w}x{widget.h}
                    </span>
                  </div>

                  {/* Widget toolbar */}
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      onClick={() => toggleVisibility(widget.widgetId)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title={t("hideWidget")}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setSizeMenuOpen(
                            sizeMenuOpen === widget.widgetId
                              ? null
                              : widget.widgetId,
                          )
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={t("resizeWidget")}
                      >
                        <Maximize className="h-3.5 w-3.5" />
                      </button>
                      {sizeMenuOpen === widget.widgetId && (
                        <div className="absolute right-0 top-6 z-10 rounded-md border bg-white shadow-md">
                          {SIZE_OPTIONS.map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() =>
                                changeSize(widget.widgetId, opt.w, opt.h)
                              }
                              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                                widget.w === opt.w && widget.h === opt.h
                                  ? "font-bold text-blue-600"
                                  : "text-gray-700"
                              }`}
                            >
                              {opt.label}
                              {widget.w === opt.w &&
                                widget.h === opt.h &&
                                " \u2713"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleWidgets.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
              {t("noWidgets")}
            </div>
          )}
        </div>

        {/* Available Widgets Panel */}
        {showWidgetPanel && (
          <div className="w-72 rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {t("availableWidgets")}
              </h3>
              <button
                onClick={() => setShowWidgetPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {WIDGET_REGISTRY.map((wd) => {
                const inLayout = layout.some((l) => l.widgetId === wd.id);
                const isVisible = layout.some(
                  (l) => l.widgetId === wd.id && l.visible,
                );
                const Icon = wd.icon;

                return (
                  <label
                    key={wd.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => {
                        if (!inLayout) {
                          addWidget(wd);
                        } else {
                          toggleVisibility(wd.id);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span
                      className={`text-sm ${
                        isVisible
                          ? "font-medium text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      {t(wd.nameKey)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
