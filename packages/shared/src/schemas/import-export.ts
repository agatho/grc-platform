import { z } from "zod";

// Sprint 19: Bulk Import/Export Zod schemas

const importEntityTypeValues = [
  "risk",
  "control",
  "asset",
  "vendor",
  "contract",
  "incident",
  "process",
  "ropa_entry",
] as const;

const importJobStatusValues = [
  "uploaded",
  "mapping",
  "validating",
  "validated",
  "executing",
  "completed",
  "failed",
] as const;

const exportFormatValues = ["csv", "xlsx", "pdf"] as const;

// ─── Import Upload ──────────────────────────────────────────

export const importUploadSchema = z.object({
  entityType: z.enum(importEntityTypeValues),
});

// ─── Column Mapping Confirmation ────────────────────────────

export const confirmColumnMappingSchema = z.object({
  mapping: z.record(z.string(), z.string().nullable()),
  saveMappingName: z.string().max(200).optional(),
});

// ─── Validate Request ───────────────────────────────────────

export const importValidateSchema = z.object({
  mapping: z.record(z.string(), z.string().nullable()),
  dryRun: z.boolean().default(true),
});

// ─── Execute Import ─────────────────────────────────────────

export const importExecuteSchema = z.object({
  mapping: z.record(z.string(), z.string().nullable()).optional(),
});

// ─── Saved Column Mapping ───────────────────────────────────

export const createColumnMappingSchema = z.object({
  entityType: z.enum(importEntityTypeValues),
  name: z.string().min(1).max(200),
  mappingJson: z.record(z.string(), z.string()),
});

// ─── Export Request ─────────────────────────────────────────

export const exportRequestSchema = z.object({
  format: z.enum(exportFormatValues).default("csv"),
});

// ─── Bulk Export ────────────────────────────────────────────

export const bulkExportSchema = z.object({
  entityTypes: z.array(z.enum(importEntityTypeValues)).min(1).max(8),
  format: z.enum(exportFormatValues).default("csv"),
});

// ─── Export Schedule ────────────────────────────────────────

export const createExportScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  entityTypes: z.array(z.enum(importEntityTypeValues)).min(1).max(8),
  format: z.enum(exportFormatValues).default("csv"),
  cronExpression: z.string().max(50).default("0 6 * * 1"),
  recipientEmails: z.array(z.string().email()).min(1).max(20),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const updateExportScheduleSchema = createExportScheduleSchema.partial();

// ─── Valid Status Transitions ───────────────────────────────

export const VALID_IMPORT_JOB_TRANSITIONS: Record<string, string[]> = {
  uploaded: ["mapping", "failed"],
  mapping: ["validating", "failed"],
  validating: ["validated", "failed"],
  validated: ["executing", "mapping", "failed"],
  executing: ["completed", "failed"],
  completed: [],
  failed: ["uploaded"],
};

// Note: ImportEntityType and ExportFormat types are defined in types/import-export.ts
