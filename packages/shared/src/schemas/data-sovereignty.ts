import { z } from "zod";

// Sprint 80: Multi-Region Deployment und Data Sovereignty — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const dataRegionCodeValues = [
  "eu_central",
  "eu_west",
  "eu_north",
  "ch",
  "uk",
  "us_east",
  "us_west",
  "ap_southeast",
] as const;

export const regionStatusValues = [
  "active",
  "provisioning",
  "maintenance",
  "decommissioned",
] as const;

export const residencyRuleTypeValues = [
  "data_at_rest",
  "data_in_transit",
  "backup",
  "logging",
  "processing",
] as const;

export const replicationStatusValues = [
  "active",
  "paused",
  "failed",
  "pending_approval",
] as const;

export const sovereigntyEventTypeValues = [
  "data_access",
  "data_transfer",
  "region_change",
  "policy_violation",
  "replication_event",
  "compliance_check",
] as const;

export const complianceFrameworkTagValues = [
  "gdpr",
  "bsi_c5",
  "soc2_type2",
  "iso27001",
  "nis2",
] as const;

// ──────────────────────────────────────────────────────────────
// Data Region CRUD
// ──────────────────────────────────────────────────────────────

export const createDataRegionSchema = z.object({
  code: z.enum(dataRegionCodeValues),
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
  endpointUrl: z.string().url().max(500).optional(),
  infraConfig: z.record(z.unknown()).default({}),
  complianceTags: z.array(z.enum(complianceFrameworkTagValues)).default([]),
  maxTenants: z.number().int().min(1).optional(),
  isDefault: z.boolean().default(false),
});

export const updateDataRegionSchema = createDataRegionSchema.partial().extend({
  status: z.enum(regionStatusValues).optional(),
});

export const listDataRegionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(regionStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Region Tenant Config
// ──────────────────────────────────────────────────────────────

export const upsertRegionTenantConfigSchema = z.object({
  primaryRegionId: z.string().uuid(),
  backupRegionId: z.string().uuid().optional().nullable(),
  isRegionLocked: z.boolean().default(true),
  lockReason: z.string().max(500).optional(),
  dataClassification: z.string().max(100).default("confidential"),
  retentionPolicy: z.record(z.unknown()).default({}),
  encryptionConfig: z.record(z.unknown()).default({}),
});

// ──────────────────────────────────────────────────────────────
// Data Residency Rule CRUD
// ──────────────────────────────────────────────────────────────

export const createDataResidencyRuleSchema = z.object({
  name: z.string().min(1).max(300),
  ruleType: z.enum(residencyRuleTypeValues),
  description: z.string().max(5000).optional(),
  allowedRegions: z.array(z.enum(dataRegionCodeValues)).default([]),
  deniedRegions: z.array(z.enum(dataRegionCodeValues)).default([]),
  complianceFramework: z.enum(complianceFrameworkTagValues).optional(),
  isEnforced: z.boolean().default(true),
  violationAction: z.enum(["block", "warn", "log"]).default("block"),
  conditionsJson: z.record(z.unknown()).default({}),
});

export const updateDataResidencyRuleSchema =
  createDataResidencyRuleSchema.partial();

export const listDataResidencyRulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  ruleType: z.enum(residencyRuleTypeValues).optional(),
  complianceFramework: z.enum(complianceFrameworkTagValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Cross-Region Replication
// ──────────────────────────────────────────────────────────────

export const createCrossRegionReplicationSchema = z.object({
  sourceRegionId: z.string().uuid(),
  targetRegionId: z.string().uuid(),
  replicationType: z.enum(["sync", "async"]).default("async"),
  tablesIncluded: z.array(z.string().max(200)).max(100).default([]),
  tablesExcluded: z.array(z.string().max(200)).max(100).default([]),
  gdprSafeguards: z.record(z.unknown()).default({}),
});

export const updateCrossRegionReplicationSchema = z.object({
  status: z.enum(replicationStatusValues).optional(),
  tablesIncluded: z.array(z.string().max(200)).max(100).optional(),
  tablesExcluded: z.array(z.string().max(200)).max(100).optional(),
  gdprSafeguards: z.record(z.unknown()).optional(),
});

export const listCrossRegionReplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(replicationStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Sovereignty Audit Log
// ──────────────────────────────────────────────────────────────

export const listSovereigntyAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  eventType: z.enum(sovereigntyEventTypeValues).optional(),
  isViolation: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateDataRegionInput = z.infer<typeof createDataRegionSchema>;
export type UpdateDataRegionInput = z.infer<typeof updateDataRegionSchema>;
export type UpsertRegionTenantConfigInput = z.infer<
  typeof upsertRegionTenantConfigSchema
>;
export type CreateDataResidencyRuleInput = z.infer<
  typeof createDataResidencyRuleSchema
>;
export type CreateCrossRegionReplicationInput = z.infer<
  typeof createCrossRegionReplicationSchema
>;
