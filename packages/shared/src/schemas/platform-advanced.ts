import { z } from "zod";

// Sprint 38: Platform Advanced — Custom Fields, Notifications, Search, Branding, Hierarchy

// ─── Custom Fields ──────────────────────────────────────────
export const createCustomFieldSchema = z.object({
  entityType: z.enum(["risk", "control", "process", "asset", "vendor", "incident", "document", "finding"]),
  fieldKey: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
  label: z.record(z.string()).refine((v) => v.de || v.en, { message: "At least de or en required" }),
  fieldType: z.enum(["text", "number", "date", "single_select", "multi_select", "url", "email", "checkbox", "rich_text", "currency"]),
  options: z.array(z.object({ value: z.string(), label: z.record(z.string()) })).optional(),
  validation: z.object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    regex: z.string().optional(),
  }).optional(),
  defaultValue: z.unknown().optional(),
  placeholder: z.record(z.string()).optional(),
  helpText: z.record(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  showInList: z.boolean().optional(),
  showInExport: z.boolean().optional(),
});

export const updateCustomFieldSchema = createCustomFieldSchema.partial().omit({ entityType: true, fieldKey: true });

export const reorderCustomFieldsSchema = z.object({
  fieldIds: z.array(z.string().uuid()).min(1).max(100),
});

// ─── Notification Preferences ───────────────────────────────
export const updateNotificationPreferenceSchema = z.object({
  notificationType: z.string().min(1).max(50),
  channel: z.enum(["in_app", "email", "both", "digest", "none"]),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  digestFrequency: z.enum(["daily", "weekly"]).optional(),
});

// ─── Search ─────────────────────────────────────────────────
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  type: z.string().max(50).optional(),
  module: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Branding ───────────────────────────────────────────────
export const updateBrandingExtendedSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emailSenderName: z.string().max(200).optional(),
  emailReplyTo: z.string().email().optional(),
  emailFooterText: z.string().max(2000).optional(),
  loginWelcomeText: z.record(z.string()).optional(),
  pdfWatermark: z.string().max(200).optional(),
  pdfConfidentiality: z.string().max(500).optional(),
  customDomain: z.string().max(255).optional(),
});

// ─── Multi-Org Hierarchy ────────────────────────────────────
export const setParentOrgSchema = z.object({
  parentOrgId: z.string().uuid().nullable(),
});
