import { z } from "zod";
import {
  reportModuleScopeValues,
  reportOutputFormatValues,
  reportSectionTypeValues,
  threatFeedTypeValues,
} from "../types/reporting";

// Sprint 30: Report Engine + Threat Landscape Dashboard Zod schemas

// ──────────────────────────────────────────────────────────────
// Section Config
// ──────────────────────────────────────────────────────────────

export const reportSectionConfigSchema = z.object({
  type: z.enum(reportSectionTypeValues),
  config: z.object({
    text: z.string().max(10000).optional(),
    dataSource: z.string().max(200).optional(),
    columns: z.array(z.string().max(100)).max(50).optional(),
    chartType: z.enum(["bar", "line", "donut", "heatmap"]).optional(),
    filters: z.record(z.string().max(200)).optional(),
    periodVariable: z.string().max(100).optional(),
    label: z.string().max(500).optional(),
    comparisonPeriod: z.string().max(50).optional(),
  }),
});

export const reportParameterDefinitionSchema = z.object({
  key: z.string().min(1).max(100),
  type: z.enum(["daterange", "select", "text", "date"]),
  label: z.string().min(1).max(200),
  required: z.boolean(),
  options: z
    .array(
      z.object({
        value: z.string().max(200),
        label: z.string().max(200),
      }),
    )
    .max(100)
    .optional(),
  defaultValue: z.string().max(500).optional(),
});

export const reportBrandingConfigSchema = z.object({
  logoUrl: z.string().url().max(1000).optional(),
  primaryColor: z.string().max(20).optional(),
  footerText: z.string().max(500).optional(),
  confidentiality: z.string().max(100).optional(),
  showPageNumbers: z.boolean().optional(),
  pageNumberPosition: z.enum(["left", "center", "right"]).optional(),
});

// ──────────────────────────────────────────────────────────────
// Template CRUD
// ──────────────────────────────────────────────────────────────

export const createReportTemplateSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  moduleScope: z.enum(reportModuleScopeValues).default("all"),
  sectionsJson: z.array(reportSectionConfigSchema).max(100).default([]),
  parametersJson: z.array(reportParameterDefinitionSchema).max(50).default([]),
  brandingJson: reportBrandingConfigSchema.optional(),
});

export const updateReportTemplateSchema = createReportTemplateSchema.partial();

export const listReportTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  moduleScope: z.enum(reportModuleScopeValues).optional(),
  search: z.string().max(200).optional(),
  isDefault: z.coerce.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Generate Report
// ──────────────────────────────────────────────────────────────

export const generateReportSchema = z.object({
  templateId: z.string().uuid(),
  parameters: z.record(z.unknown()).default({}),
  outputFormat: z.enum(reportOutputFormatValues).default("pdf"),
});

// ──────────────────────────────────────────────────────────────
// Report History
// ──────────────────────────────────────────────────────────────

export const reportHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  templateId: z.string().uuid().optional(),
  status: z.enum(["queued", "generating", "completed", "failed"]).optional(),
});

// ──────────────────────────────────────────────────────────────
// Schedule CRUD
// ──────────────────────────────────────────────────────────────

export const createReportScheduleSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(500).optional(),
  cronExpression: z.string().min(1).max(100),
  parametersJson: z.record(z.unknown()).default({}),
  recipientEmails: z.array(z.string().email().max(254)).min(1).max(50),
  outputFormat: z.enum(reportOutputFormatValues).default("pdf"),
  isActive: z.boolean().default(true),
});

export const updateReportScheduleSchema = createReportScheduleSchema.partial();

export const listReportSchedulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  templateId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Threat Feed Source
// ──────────────────────────────────────────────────────────────

export const createThreatFeedSourceSchema = z.object({
  name: z.string().min(1).max(200),
  feedUrl: z.string().url().max(1000),
  feedType: z.enum(threatFeedTypeValues).default("rss"),
  isActive: z.boolean().default(true),
});

export const updateThreatFeedSourceSchema =
  createThreatFeedSourceSchema.partial();

// ──────────────────────────────────────────────────────────────
// Threat Dashboard
// ──────────────────────────────────────────────────────────────

export const threatDashboardQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

export const threatFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.string().uuid().optional(),
});

export const threatTrendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});
