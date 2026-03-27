import { z } from "zod";

// Sprint 18: Custom Dashboards Zod Schemas

// ──────────── Widget Position ────────────

export const dashboardWidgetPositionSchema = z.object({
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  minW: z.number().int().min(1).optional(),
  minH: z.number().int().min(1).optional(),
  maxW: z.number().int().max(12).optional(),
  maxH: z.number().int().max(12).optional(),
});

// ──────────── Widget Display Options ────────────

export const widgetDisplayOptionsSchema = z.object({
  title: z.string().max(200).optional(),
  color: z.string().max(50).optional(),
  chartType: z.enum(["donut", "bar", "line", "radar"]).optional(),
  timeRange: z.enum(["week", "month", "quarter", "year"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  showTrend: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  axisLabels: z.boolean().optional(),
  comparisonPeriod: z.enum(["previous_month", "previous_year"]).optional(),
  columns: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  maxRows: z.number().int().min(1).max(100).optional(),
});

// ──────────── Widget Config ────────────

export const widgetConfigSchema = z.object({
  dataSource: z.string().min(1).max(500).regex(/^\/api\/v1\//, {
    message: "Data source must reference an internal API endpoint (/api/v1/*)",
  }),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  displayOptions: widgetDisplayOptionsSchema.default({}),
});

// ──────────── Layout Item ────────────

export const layoutItemSchema = z.object({
  i: z.string().uuid(),
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  minW: z.number().int().min(1).optional(),
  minH: z.number().int().min(1).optional(),
  maxW: z.number().int().max(12).optional(),
  maxH: z.number().int().max(12).optional(),
});

// ──────────── Dashboard CRUD ────────────

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["personal", "team", "org"]).default("personal"),
  layoutJson: z.array(layoutItemSchema).default([]),
  isDefault: z.boolean().default(false),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(["personal", "team", "org"]).optional(),
  layoutJson: z.array(layoutItemSchema).optional(),
  isDefault: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export const duplicateDashboardSchema = z.object({
  name: z.string().min(1).max(500),
});

// ──────────── Widget CRUD ────────────

export const addWidgetSchema = z.object({
  widgetDefinitionId: z.string().uuid(),
  positionJson: dashboardWidgetPositionSchema,
  configJson: widgetConfigSchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateWidgetSchema = z.object({
  positionJson: dashboardWidgetPositionSchema.optional(),
  configJson: widgetConfigSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ──────────── Query Schemas ────────────

export const dashboardListQuerySchema = z.object({
  visibility: z.enum(["personal", "team", "org"]).optional(),
  isDefault: z.string().transform((v) => v === "true").optional(),
  isFavorite: z.string().transform((v) => v === "true").optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ──────────── PDF Export ────────────

export const exportPdfSchema = z.object({
  format: z.enum(["a4_landscape", "a4_portrait"]).default("a4_landscape"),
});

// ──────────── Layout Validation Helpers ────────────

export function validateLayout(layout: Array<{ i: string; x: number; y: number; w: number; h: number }>): boolean {
  for (const item of layout) {
    if (item.w > 12) return false;
    if (item.x + item.w > 12) return false;
    if (item.x < 0 || item.y < 0) return false;
    if (item.w < 1 || item.h < 1) return false;
  }
  return true;
}

export function serializeLayout(layout: Array<{ i: string; x: number; y: number; w: number; h: number }>): string {
  return JSON.stringify(layout);
}

export function resolveWidgetUrl(config: { dataSource: string; filters?: Record<string, string | number | boolean> }): string {
  const url = new URL(config.dataSource, "http://localhost");
  if (config.filters) {
    for (const [key, value] of Object.entries(config.filters)) {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}
