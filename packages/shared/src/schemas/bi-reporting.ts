import { z } from "zod";

// Sprint 77: Embedded BI und Report Builder — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const biReportStatusValues = ["draft", "published", "archived"] as const;
export const biWidgetTypeValues = [
  "kpi_card", "bar_chart", "line_chart", "donut_chart", "heatmap",
  "table", "text_block", "radar_chart", "gauge", "treemap",
] as const;
export const biDataSourceTypeValues = [
  "erm", "isms", "audit", "bcms", "esg", "ics", "dpms", "tprm", "bpm", "custom_sql",
] as const;
export const biQueryStatusValues = ["draft", "validated", "failed"] as const;
export const biShareAccessValues = ["view", "edit"] as const;
export const biScheduleFrequencyValues = ["daily", "weekly", "monthly", "quarterly"] as const;
export const biExecutionStatusValues = ["queued", "running", "completed", "failed"] as const;
export const biOutputFormatValues = ["pdf", "xlsx", "csv", "pptx"] as const;

// ──────────────────────────────────────────────────────────────
// Widget Position
// ──────────────────────────────────────────────────────────────

export const biWidgetPositionSchema = z.object({
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
});

// ──────────────────────────────────────────────────────────────
// BI Report CRUD
// ──────────────────────────────────────────────────────────────

export const createBiReportSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  moduleScope: z.string().max(50).default("all"),
  layoutJson: z.array(z.record(z.unknown())).max(100).default([]),
  filtersJson: z.record(z.unknown()).default({}),
  parametersJson: z.array(z.record(z.unknown())).max(50).default([]),
  isTemplate: z.boolean().default(false),
  templateCategory: z.string().max(100).optional(),
});

export const updateBiReportSchema = createBiReportSchema.partial().extend({
  status: z.enum(biReportStatusValues).optional(),
});

export const listBiReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(biReportStatusValues).optional(),
  moduleScope: z.string().max(50).optional(),
  isTemplate: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
});

// ──────────────────────────────────────────────────────────────
// BI Report Widget CRUD
// ──────────────────────────────────────────────────────────────

export const createBiReportWidgetSchema = z.object({
  reportId: z.string().uuid(),
  widgetType: z.enum(biWidgetTypeValues),
  title: z.string().max(300).optional(),
  dataSourceType: z.enum(biDataSourceTypeValues),
  queryId: z.string().uuid().optional(),
  configJson: z.record(z.unknown()).default({}),
  positionJson: biWidgetPositionSchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateBiReportWidgetSchema = createBiReportWidgetSchema.partial().omit({ reportId: true });

// ──────────────────────────────────────────────────────────────
// BI Data Source CRUD
// ──────────────────────────────────────────────────────────────

export const createBiDataSourceSchema = z.object({
  name: z.string().min(1).max(300),
  sourceType: z.enum(biDataSourceTypeValues),
  description: z.string().max(5000).optional(),
  schemaDefinition: z.record(z.unknown()).default({}),
  availableColumns: z.array(z.record(z.unknown())).max(500).default([]),
  defaultFilters: z.record(z.unknown()).default({}),
  refreshIntervalMinutes: z.number().int().min(1).max(1440).default(60),
});

export const updateBiDataSourceSchema = createBiDataSourceSchema.partial();

export const listBiDataSourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceType: z.enum(biDataSourceTypeValues).optional(),
  search: z.string().max(200).optional(),
});

// ──────────────────────────────────────────────────────────────
// BI Query CRUD
// ──────────────────────────────────────────────────────────────

export const createBiQuerySchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  dataSourceId: z.string().uuid().optional(),
  sqlText: z.string().min(1).max(50000),
});

export const updateBiQuerySchema = createBiQuerySchema.partial();

export const executeBiQuerySchema = z.object({
  queryId: z.string().uuid(),
  parameters: z.record(z.unknown()).default({}),
  limit: z.number().int().min(1).max(10000).default(1000),
});

export const listBiQueriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(biQueryStatusValues).optional(),
  search: z.string().max(200).optional(),
});

// ──────────────────────────────────────────────────────────────
// BI Shared Dashboard
// ──────────────────────────────────────────────────────────────

export const createBiShareSchema = z.object({
  reportId: z.string().uuid(),
  accessLevel: z.enum(biShareAccessValues).default("view"),
  password: z.string().min(6).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateBiShareSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(100).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ──────────────────────────────────────────────────────────────
// BI Brand Config
// ──────────────────────────────────────────────────────────────

export const upsertBiBrandConfigSchema = z.object({
  logoUrl: z.string().url().max(1000).optional().nullable(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  fontFamily: z.string().max(100).optional(),
  headerText: z.string().max(500).optional(),
  footerText: z.string().max(500).optional(),
  confidentialityLabel: z.string().max(200).optional(),
  showPageNumbers: z.boolean().default(true),
  customCss: z.string().max(50000).optional().nullable(),
});

// ──────────────────────────────────────────────────────────────
// BI Scheduled Report
// ──────────────────────────────────────────────────────────────

export const createBiScheduledReportSchema = z.object({
  reportId: z.string().uuid(),
  name: z.string().min(1).max(500),
  frequency: z.enum(biScheduleFrequencyValues),
  cronExpression: z.string().max(100).optional(),
  outputFormat: z.enum(biOutputFormatValues).default("pdf"),
  recipientEmails: z.array(z.string().email().max(254)).min(1).max(50),
  parametersJson: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

export const updateBiScheduledReportSchema = createBiScheduledReportSchema.partial().omit({ reportId: true });

// ──────────────────────────────────────────────────────────────
// BI Report Execution
// ──────────────────────────────────────────────────────────────

export const triggerBiReportExecutionSchema = z.object({
  reportId: z.string().uuid(),
  outputFormat: z.enum(biOutputFormatValues).default("pdf"),
  parametersJson: z.record(z.unknown()).default({}),
});

export const listBiExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  reportId: z.string().uuid().optional(),
  status: z.enum(biExecutionStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateBiReportInput = z.infer<typeof createBiReportSchema>;
export type UpdateBiReportInput = z.infer<typeof updateBiReportSchema>;
export type CreateBiReportWidgetInput = z.infer<typeof createBiReportWidgetSchema>;
export type CreateBiDataSourceInput = z.infer<typeof createBiDataSourceSchema>;
export type CreateBiQueryInput = z.infer<typeof createBiQuerySchema>;
export type CreateBiShareInput = z.infer<typeof createBiShareSchema>;
export type UpsertBiBrandConfigInput = z.infer<typeof upsertBiBrandConfigSchema>;
export type CreateBiScheduledReportInput = z.infer<typeof createBiScheduledReportSchema>;
export type TriggerBiReportExecutionInput = z.infer<typeof triggerBiReportExecutionSchema>;
