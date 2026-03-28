import { z } from "zod";

// Sprint 81: Role-Based Experience Redesign — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const roleDashboardTypeValues = [
  "ciso", "cfo", "board", "auditor", "department_manager", "risk_manager", "dpo", "custom",
] as const;

export const roleDashboardWidgetCategoryValues = [
  "risk_posture", "threat_intel", "top_risks", "financial_exposure",
  "audit_effort", "grc_roi", "maturity_radar", "findings_overview",
  "evidence_quality", "department_summary", "compliance_status", "kpi_summary",
] as const;

// ──────────────────────────────────────────────────────────────
// Role Dashboard Config CRUD
// ──────────────────────────────────────────────────────────────

export const createRoleDashboardConfigSchema = z.object({
  dashboardType: z.enum(roleDashboardTypeValues),
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  layoutJson: z.array(z.record(z.unknown())).max(50).default([]),
  widgetsJson: z.array(z.object({
    key: z.string().max(200),
    category: z.enum(roleDashboardWidgetCategoryValues),
    title: z.string().max(300),
    dataSource: z.string().max(500),
    chartType: z.string().max(50).optional(),
    configJson: z.record(z.unknown()).default({}),
    position: z.object({
      x: z.number().int().min(0).max(12),
      y: z.number().int().min(0),
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(12),
    }).optional(),
  })).max(50).default([]),
  filtersJson: z.record(z.unknown()).default({}),
  refreshIntervalSeconds: z.number().int().min(30).max(3600).default(300),
  isDefault: z.boolean().default(false),
});

export const updateRoleDashboardConfigSchema = createRoleDashboardConfigSchema.partial().omit({ dashboardType: true });

export const listRoleDashboardConfigsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dashboardType: z.enum(roleDashboardTypeValues).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Widget Preference CRUD
// ──────────────────────────────────────────────────────────────

export const upsertWidgetPreferenceSchema = z.object({
  dashboardConfigId: z.string().uuid(),
  widgetKey: z.string().min(1).max(200),
  isVisible: z.boolean().default(true),
  positionOverride: z.object({
    x: z.number().int().min(0).max(12),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
  }).optional(),
  configOverride: z.record(z.unknown()).optional(),
});

export const bulkUpsertWidgetPreferencesSchema = z.object({
  dashboardConfigId: z.string().uuid(),
  preferences: z.array(z.object({
    widgetKey: z.string().min(1).max(200),
    isVisible: z.boolean().default(true),
    positionOverride: z.object({
      x: z.number().int().min(0).max(12),
      y: z.number().int().min(0),
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(12),
    }).optional(),
    configOverride: z.record(z.unknown()).optional(),
  })).max(100),
});

// ──────────────────────────────────────────────────────────────
// Dashboard Data Endpoints
// ──────────────────────────────────────────────────────────────

export const cisoDashboardQuerySchema = z.object({
  timeRange: z.enum(["week", "month", "quarter", "year"]).default("quarter"),
  topN: z.coerce.number().int().min(3).max(20).default(10),
});

export const cfoDashboardQuerySchema = z.object({
  timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
  currency: z.string().length(3).default("EUR"),
});

export const boardDashboardQuerySchema = z.object({
  language: z.enum(["de", "en"]).default("de"),
  simplified: z.coerce.boolean().default(true),
});

export const auditorDashboardQuerySchema = z.object({
  timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
  status: z.enum(["open", "in_progress", "closed"]).optional(),
});

export const departmentManagerDashboardQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateRoleDashboardConfigInput = z.infer<typeof createRoleDashboardConfigSchema>;
export type UpdateRoleDashboardConfigInput = z.infer<typeof updateRoleDashboardConfigSchema>;
export type UpsertWidgetPreferenceInput = z.infer<typeof upsertWidgetPreferenceSchema>;
export type BulkUpsertWidgetPreferencesInput = z.infer<typeof bulkUpsertWidgetPreferencesSchema>;
