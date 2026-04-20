import { z } from "zod";

// Sprint 65: DevOps und IT Connectors Zod schemas

export const devopsPlatformValues = [
  "github",
  "gitlab",
  "bitbucket",
  "jira",
  "confluence",
  "servicenow",
  "wiki_generic",
] as const;

export const devopsPlatformCategoryValues = [
  "git_platform",
  "issue_tracker",
  "wiki",
  "endpoint_mgmt",
  "network_firewall",
] as const;

export const devopsTestCategoryValues = [
  "branch_protection",
  "code_review",
  "sast",
  "secret_scanning",
  "sla_compliance",
  "docs_freshness",
  "endpoint_compliance",
  "firewall_rules",
] as const;

export const devopsResourceTypeValues = [
  "repository",
  "project",
  "space",
  "endpoint",
  "firewall",
] as const;

export const itCheckTypeValues = [
  "endpoint_encryption",
  "endpoint_patching",
  "endpoint_antivirus",
  "firewall_rule_review",
  "network_segmentation",
  "vpn_config",
  "certificate_expiry",
] as const;

export const infraComplianceStatusValues = [
  "compliant",
  "non_compliant",
  "warning",
  "error",
] as const;

// ─── DevOps Connector Config CRUD ──────────────────────────

export const createDevopsConnectorConfigSchema = z.object({
  connectorId: z.string().uuid(),
  platform: z.enum(devopsPlatformValues),
  platformCategory: z.enum(devopsPlatformCategoryValues),
  branchProtectionCheck: z.boolean().default(true),
  codeReviewCheck: z.boolean().default(true),
  sastEnabled: z.boolean().default(true),
  secretScanningCheck: z.boolean().default(true),
  slaComplianceCheck: z.boolean().default(true),
  docsFreshnessCheck: z.boolean().default(true),
  docsFreshnessMaxDays: z.number().int().min(30).max(730).default(180),
  endpointComplianceCheck: z.boolean().default(false),
  firewallRuleCheck: z.boolean().default(false),
  repositories: z.array(z.string().max(255)).max(100).optional(),
  projects: z.array(z.string().max(255)).max(100).optional(),
  spaces: z.array(z.string().max(255)).max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateDevopsConnectorConfigSchema = z.object({
  branchProtectionCheck: z.boolean().optional(),
  codeReviewCheck: z.boolean().optional(),
  sastEnabled: z.boolean().optional(),
  secretScanningCheck: z.boolean().optional(),
  slaComplianceCheck: z.boolean().optional(),
  docsFreshnessCheck: z.boolean().optional(),
  docsFreshnessMaxDays: z.number().int().min(30).max(730).optional(),
  endpointComplianceCheck: z.boolean().optional(),
  firewallRuleCheck: z.boolean().optional(),
  repositories: z.array(z.string().max(255)).max(100).optional(),
  projects: z.array(z.string().max(255)).max(100).optional(),
  spaces: z.array(z.string().max(255)).max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

// ─── Query Schemas ─────────────────────────────────────────

export const devopsTestResultQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  testCategory: z.enum(devopsTestCategoryValues).optional(),
  resourceType: z.enum(devopsResourceTypeValues).optional(),
  status: z.enum(["pass", "fail", "warning", "error", "skipped"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const itInfraCheckQuerySchema = z.object({
  connectorId: z.string().uuid().optional(),
  checkType: z.enum(itCheckTypeValues).optional(),
  status: z.enum(infraComplianceStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Trigger Scan ──────────────────────────────────────────

export const triggerDevopsScanSchema = z.object({
  configId: z.string().uuid(),
  categories: z
    .array(z.enum(devopsTestCategoryValues))
    .min(1)
    .max(10)
    .optional(),
});
