import { z } from "zod";

// Sprint 63: Cloud Infrastructure Connectors Zod schemas

export const cloudProviderValues = ["aws", "azure", "gcp"] as const;

export const cloudExecutionStatusValues = ["running", "completed", "failed", "cancelled"] as const;

export const cloudTriggerValues = ["schedule", "manual", "api"] as const;

// ─── Cloud Test Suite CRUD ─────────────────────────────────

export const createCloudTestSuiteSchema = z.object({
  connectorId: z.string().uuid(),
  provider: z.enum(cloudProviderValues),
  suiteName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  testKeys: z.array(z.string().max(100)).min(1).max(100),
  isEnabled: z.boolean().default(true),
});

export const updateCloudTestSuiteSchema = z.object({
  suiteName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  testKeys: z.array(z.string().max(100)).min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
});

// ─── Cloud Test Execution ──────────────────────────────────

export const triggerCloudTestSchema = z.object({
  suiteId: z.string().uuid(),
  triggeredBy: z.enum(cloudTriggerValues).default("manual"),
});

// ─── Query Schemas ─────────────────────────────────────────

export const cloudSuiteQuerySchema = z.object({
  provider: z.enum(cloudProviderValues).optional(),
  connectorId: z.string().uuid().optional(),
  isEnabled: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cloudExecutionQuerySchema = z.object({
  suiteId: z.string().uuid().optional(),
  provider: z.enum(cloudProviderValues).optional(),
  status: z.enum(cloudExecutionStatusValues).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cloudSnapshotQuerySchema = z.object({
  provider: z.enum(cloudProviderValues).optional(),
  connectorId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
