"use client";

import React from "react";
import type { WidgetConfig, WidgetType } from "@grc/shared";
import { KPICardWidget } from "./widgets/kpi-card-widget";
import { DonutChartWidget } from "./widgets/donut-chart-widget";
import { BarChartWidget } from "./widgets/bar-chart-widget";
import { LineChartWidget } from "./widgets/line-chart-widget";
import { DataTableWidget } from "./widgets/data-table-widget";
import { HeatmapWidget } from "./widgets/heatmap-widget";
import { CountdownWidget } from "./widgets/countdown-widget";
import { ComplianceScoreWidget } from "./widgets/compliance-score-widget";
import { RadarChartWidget } from "./widgets/radar-chart-widget";
import { GaugeWidget } from "./widgets/gauge-widget";

// ──────────────────────────────────────────────────────────────
// Widget Props Interface
// ──────────────────────────────────────────────────────────────

export interface WidgetProps {
  data: unknown;
  config: WidgetConfig;
  isLoading: boolean;
  error?: string;
  title?: string;
}

// ──────────────────────────────────────────────────────────────
// Widget Renderer Registry
// ──────────────────────────────────────────────────────────────

const WIDGET_RENDERERS: Record<string, React.ComponentType<WidgetProps>> = {
  // KPI type widgets
  kpi_risk_count: KPICardWidget,
  kpi_open_findings: KPICardWidget,
  kpi_avg_ces: KPICardWidget,
  kpi_audit_sla: KPICardWidget,
  kpi_dsr_sla: KPICardWidget,
  // Chart type widgets
  chart_risk_distribution: DonutChartWidget,
  chart_ces_trend: LineChartWidget,
  chart_finding_aging: BarChartWidget,
  chart_kri_trend: LineChartWidget,
  chart_incident_monthly: BarChartWidget,
  // Table type widgets
  table_top_risks: DataTableWidget,
  table_overdue_tasks: DataTableWidget,
  table_expiring_contracts: DataTableWidget,
  table_recent_findings: DataTableWidget,
  // Special type widgets
  special_risk_heatmap: HeatmapWidget,
  special_compliance_calendar: CountdownWidget,
  special_assurance_radar: RadarChartWidget,
  special_posture_gauge: GaugeWidget,
  special_appetite_bars: BarChartWidget,
  special_budget_burnrate: GaugeWidget,
};

// Map widget type category to a default renderer
const TYPE_FALLBACK_RENDERERS: Record<string, React.ComponentType<WidgetProps>> = {
  kpi: KPICardWidget,
  chart: BarChartWidget,
  table: DataTableWidget,
  special: ComplianceScoreWidget,
};

export function getWidgetRenderer(
  definitionKey: string,
  widgetType?: string,
): React.ComponentType<WidgetProps> {
  return (
    WIDGET_RENDERERS[definitionKey] ??
    (widgetType ? TYPE_FALLBACK_RENDERERS[widgetType] : undefined) ??
    KPICardWidget
  );
}

// ──────────────────────────────────────────────────────────────
// Widget Type Metadata (for catalog display)
// ──────────────────────────────────────────────────────────────

export const WIDGET_TYPE_GROUPS: Record<WidgetType, { labelDe: string; labelEn: string }> = {
  kpi: { labelDe: "KPI-Karten", labelEn: "KPI Cards" },
  chart: { labelDe: "Diagramme", labelEn: "Charts" },
  table: { labelDe: "Tabellen", labelEn: "Tables" },
  special: { labelDe: "Spezial", labelEn: "Special" },
};
