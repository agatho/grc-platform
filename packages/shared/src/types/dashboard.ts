// Sprint 18: Custom Dashboards Types

export type WidgetType = "kpi" | "chart" | "table" | "special";
export type DashboardVisibility = "personal" | "team" | "org";
export type ChartType = "donut" | "bar" | "line" | "radar";

export interface WidgetDisplayOptions {
  title?: string;
  color?: string;
  chartType?: ChartType;
  timeRange?: "week" | "month" | "quarter" | "year";
  limit?: number;
  showTrend?: boolean;
  showLegend?: boolean;
  axisLabels?: boolean;
  comparisonPeriod?: "previous_month" | "previous_year";
  columns?: string[];
  sortBy?: string;
  maxRows?: number;
}

export interface WidgetConfig {
  dataSource: string;
  filters: Record<string, string | number | boolean>;
  displayOptions: WidgetDisplayOptions;
}

export interface DashboardWidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface LayoutItem {
  i: string; // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetDefinitionRecord {
  id: string;
  key: string;
  nameDe: string;
  nameEn: string;
  descriptionDe?: string | null;
  descriptionEn?: string | null;
  type: WidgetType;
  defaultConfig: WidgetConfig;
  minWidth: number;
  minHeight: number;
  maxWidth: number | null;
  maxHeight: number | null;
  requiredPermissions: string[] | null;
  previewImageUrl: string | null;
  isActive: boolean;
}

export interface CustomDashboardRecord {
  id: string;
  orgId: string;
  userId: string | null;
  name: string;
  description: string | null;
  visibility: DashboardVisibility;
  layoutJson: LayoutItem[];
  isDefault: boolean;
  isFavorite: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CustomDashboardWidgetRecord {
  id: string;
  dashboardId: string;
  widgetDefinitionId: string;
  positionJson: DashboardWidgetPosition;
  configJson: WidgetConfig;
  sortOrder: number;
}

export interface DashboardWithWidgets extends CustomDashboardRecord {
  widgets: (CustomDashboardWidgetRecord & {
    definition: WidgetDefinitionRecord;
  })[];
}

export interface WidgetDataResult {
  widgetId: string;
  status: "fulfilled" | "rejected";
  data?: unknown;
  error?: string;
}

export interface BatchWidgetDataResponse {
  widgetData: Record<
    string,
    { status: string; data?: unknown; error?: string }
  >;
}
