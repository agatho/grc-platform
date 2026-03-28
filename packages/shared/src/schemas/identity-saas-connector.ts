import { z } from "zod";

// Sprint 64: Identity und SaaS Connectors Zod schemas

export const identityProviderValues = ["entra_id", "google_workspace", "okta", "generic_oidc", "hr_system"] as const;

export const identityTestCategoryValues = [
  "mfa_enforcement", "stale_accounts", "password_policy", "access_review",
  "privileged_accounts", "guest_access", "conditional_access", "dlp",
  "retention", "onboarding", "offboarding",
] as const;

export const saasPlatformValues = ["m365", "google_workspace", "hr_system"] as const;

export const saasCheckTypeValues = [
  "dlp_policy", "retention_policy", "sharing_policy", "external_sharing",
  "mailbox_audit", "drive_sharing", "onboarding_sla", "offboarding_sla",
] as const;

export const saasComplianceStatusValues = ["compliant", "non_compliant", "partial", "error", "not_applicable"] as const;

export const syncIntervalValues = ["hourly", "daily", "weekly"] as const;

// ─── Identity Connector Config CRUD ────────────────────────

export const createIdentityConnectorConfigSchema = z.object({
  connectorId: z.string().uuid(),
  identityProvider: z.enum(identityProviderValues),
  tenantId: z.string().max(255).optional(),
  domain: z.string().max(255).optional(),
  syncEnabled: z.boolean().default(false),
  syncInterval: z.enum(syncIntervalValues).default("daily"),
  mfaCheckEnabled: z.boolean().default(true),
  staleAccountDays: z.number().int().min(30).max(365).default(90),
  passwordPolicyCheck: z.boolean().default(true),
  accessReviewEnabled: z.boolean().default(true),
  privilegedAccountMonitoring: z.boolean().default(true),
  guestAccessCheck: z.boolean().default(true),
  conditionalAccessCheck: z.boolean().default(true),
  dlpEnabled: z.boolean().default(false),
  retentionPolicyCheck: z.boolean().default(false),
  onboardingCheck: z.boolean().default(false),
  offboardingCheck: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

export const updateIdentityConnectorConfigSchema = z.object({
  syncEnabled: z.boolean().optional(),
  syncInterval: z.enum(syncIntervalValues).optional(),
  mfaCheckEnabled: z.boolean().optional(),
  staleAccountDays: z.number().int().min(30).max(365).optional(),
  passwordPolicyCheck: z.boolean().optional(),
  accessReviewEnabled: z.boolean().optional(),
  privilegedAccountMonitoring: z.boolean().optional(),
  guestAccessCheck: z.boolean().optional(),
  conditionalAccessCheck: z.boolean().optional(),
  dlpEnabled: z.boolean().optional(),
  retentionPolicyCheck: z.boolean().optional(),
  onboardingCheck: z.boolean().optional(),
  offboardingCheck: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

// ─── Query Schemas ─────────────────────────────────────────

export const identityTestResultQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  testCategory: z.enum(identityTestCategoryValues).optional(),
  status: z.enum(["pass", "fail", "warning", "error", "skipped"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const saasComplianceQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  platform: z.enum(saasPlatformValues).optional(),
  checkType: z.enum(saasCheckTypeValues).optional(),
  status: z.enum(saasComplianceStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Trigger Sync ──────────────────────────────────────────

export const triggerIdentitySyncSchema = z.object({
  configId: z.string().uuid(),
  categories: z.array(z.enum(identityTestCategoryValues)).min(1).max(20).optional(),
});
