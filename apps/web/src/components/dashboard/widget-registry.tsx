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
const TYPE_FALLBACK_RENDERERS: Record<
  string,
  React.ComponentType<WidgetProps>
> = {
  kpi: KPICardWidget,
  chart: BarChartWidget,
  table: DataTableWidget,
  special: ComplianceScoreWidget,
};

/**
 * Die Kachel selbst — als Komponente auf Modulebene, nicht als Nachschlag an
 * der Aufrufstelle.
 *
 * [Welle 7a · OP-080] `dashboard-widget-frame.tsx` schrieb
 * `const WidgetRenderer = getWidgetRenderer(...)` in seinen Rumpf und setzte
 * das Ergebnis als JSX-Typ ein. `react-hooks/static-components` sieht dabei
 * nur, dass der Typ des Elements aus einem AUFRUF stammt: über die
 * Funktionsgrenze kann die Regel nicht nachsehen, ob dabei immer dieselbe
 * Komponente herauskommt. Ein Typ, der sich an derselben Stelle ändert, hängt
 * den Teilbaum aus und wieder ein — der Zustand der Kachel wäre weg.
 *
 * Nachgemessen: über den Nachschlag IM Rumpf einer Modulkomponente kann die
 * Regel sehen (`M1[k] ?? … ?? A` meldet nichts, `f(k)` meldet). Hier steht
 * derselbe Ausdruck, den vorher `getWidgetRenderer` gekapselt hat, nur an
 * der Stelle, an der er nachprüfbar ist.
 *
 * `getWidgetRenderer` ist damit ERSATZLOS entfallen: Nach der Umstellung
 * hatte es keinen Aufrufer mehr ausser einem Sammelexport, den niemand
 * importiert — das Dead-Exports-Tor hat genau das gemeldet. Es fordert
 * wörtlich ‚Entfernen, nicht in die Ratsche aufnehmen‘; die Ratsche
 * steht deshalb unverändert.
 */
export function WidgetRenderer({
  definitionKey,
  widgetType,
  ...props
}: WidgetProps & {
  definitionKey: string;
  widgetType?: string;
}) {
  const Renderer =
    WIDGET_RENDERERS[definitionKey] ??
    (widgetType ? TYPE_FALLBACK_RENDERERS[widgetType] : undefined) ??
    KPICardWidget;
  return <Renderer {...props} />;
}

// ──────────────────────────────────────────────────────────────
// Widget Type Metadata (for catalog display)
// ──────────────────────────────────────────────────────────────

export const WIDGET_TYPE_GROUPS: Record<
  WidgetType,
  { labelDe: string; labelEn: string }
> = {
  kpi: { labelDe: "KPI-Karten", labelEn: "KPI Cards" },
  chart: { labelDe: "Diagramme", labelEn: "Charts" },
  table: { labelDe: "Tabellen", labelEn: "Tables" },
  special: { labelDe: "Spezial", labelEn: "Special" },
};
