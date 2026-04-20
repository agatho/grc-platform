import { z } from "zod";

// Sprint 62: Evidence Connector Framework Zod schemas

export const connectorTypeValues = [
  "aws",
  "azure",
  "gcp",
  "entra_id",
  "google_workspace",
  "m365",
  "git_platform",
  "issue_tracker",
  "endpoint_mgmt",
  "network_firewall",
  "wiki",
  "hr_system",
  "custom_api",
  "file_import",
] as const;

export const connectorStatusValues = [
  "inactive",
  "active",
  "error",
  "disabled",
  "pending_setup",
] as const;

export const connectorAuthMethodValues = [
  "oauth2",
  "api_key",
  "service_account",
  "certificate",
  "basic_auth",
] as const;

export const connectorHealthStatusValues = [
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
] as const;

export const credentialTypeValues = [
  "oauth2_token",
  "api_key",
  "service_account_json",
  "client_certificate",
  "basic_credentials",
] as const;

export const artifactTypeValues = [
  "screenshot",
  "json_export",
  "csv_export",
  "pdf_report",
  "log_extract",
  "config_snapshot",
  "api_response",
] as const;

export const testResultStatusValues = [
  "pass",
  "fail",
  "error",
  "skipped",
  "warning",
] as const;

export const testSeverityValues = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
] as const;

export const testCategoryValues = [
  "iam",
  "encryption",
  "logging",
  "network",
  "data_protection",
  "access_control",
  "configuration",
  "monitoring",
] as const;

export const healthCheckTypeValues = [
  "connectivity",
  "authentication",
  "authorization",
  "data_access",
] as const;

// ─── Connector CRUD ────────────────────────────────────────

export const createEvidenceConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  connectorType: z.enum(connectorTypeValues),
  providerKey: z.string().min(1).max(100),
  authMethod: z.enum(connectorAuthMethodValues),
  baseUrl: z.string().url().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateEvidenceConnectorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(connectorStatusValues).optional(),
  baseUrl: z.string().url().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
});

// ─── Credential CRUD ────────────────────────────────────────

export const createConnectorCredentialSchema = z.object({
  credentialType: z.enum(credentialTypeValues),
  payload: z.string().min(1).max(50000), // raw payload, will be encrypted server-side
  scopes: z.array(z.string().max(100)).max(50).optional(),
});

export const rotateCredentialSchema = z.object({
  payload: z.string().min(1).max(50000),
});

// ─── Schedule CRUD ──────────────────────────────────────────

export const createConnectorScheduleSchema = z.object({
  cronExpression: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50).default("Europe/Berlin"),
  isEnabled: z.boolean().default(true),
  testIds: z.array(z.string().max(100)).max(100).optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
});

export const updateConnectorScheduleSchema = z.object({
  cronExpression: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(50).optional(),
  isEnabled: z.boolean().optional(),
  testIds: z.array(z.string().max(100)).max(100).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

// ─── Freshness Config CRUD ─────────────────────────────────

export const createFreshnessConfigSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid().optional(),
  connectorId: z.string().uuid().optional(),
  testKey: z.string().max(100).optional(),
  maxAgeDays: z.number().int().min(1).max(365).default(30),
  warningDays: z.number().int().min(1).max(90).default(7),
  autoCollect: z.boolean().default(true),
  notifyOnStale: z.boolean().default(true),
  notifyRoles: z.array(z.string().max(50)).max(10).optional(),
});

export const updateFreshnessConfigSchema = z.object({
  maxAgeDays: z.number().int().min(1).max(365).optional(),
  warningDays: z.number().int().min(1).max(90).optional(),
  autoCollect: z.boolean().optional(),
  notifyOnStale: z.boolean().optional(),
  notifyRoles: z.array(z.string().max(50)).max(10).optional(),
});

// ─── Query Schemas ─────────────────────────────────────────

export const connectorQuerySchema = z.object({
  connectorType: z.enum(connectorTypeValues).optional(),
  status: z.enum(connectorStatusValues).optional(),
  healthStatus: z.enum(connectorHealthStatusValues).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const testResultQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  status: z.enum(testResultStatusValues).optional(),
  severity: z.enum(testSeverityValues).optional(),
  category: z.enum(testCategoryValues).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const artifactQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  artifactType: z.enum(artifactTypeValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const testDefinitionQuerySchema = z.object({
  connectorType: z.enum(connectorTypeValues).optional(),
  category: z.enum(testCategoryValues).optional(),
  severity: z.enum(testSeverityValues).optional(),
  providerKey: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Trigger test run ──────────────────────────────────────

export const triggerTestRunSchema = z.object({
  testKeys: z.array(z.string().max(100)).min(1).max(100).optional(),
});
