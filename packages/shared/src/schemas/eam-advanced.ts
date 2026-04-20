import { z } from "zod";

// Sprint 37: EAM Advanced Zod Schemas

// ──────────────────────────────────────────────────────────────
// Data Flow
// ──────────────────────────────────────────────────────────────

export const createDataFlowSchema = z.object({
  sourceElementId: z.string().uuid(),
  targetElementId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  dataCategories: z.array(z.string().max(50)).min(1).max(20),
  containsPersonalData: z.boolean().default(false),
  transferMechanism: z.enum([
    "api",
    "file_transfer",
    "message_queue",
    "database_replication",
    "manual",
  ]),
  encryptionInTransit: z.enum(["tls", "vpn", "none"]).default("tls"),
  encryptionAtRest: z.enum(["aes256", "none"]).default("aes256"),
  frequency: z.enum([
    "real_time",
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "on_demand",
  ]),
  volumePerDay: z.string().max(100).optional(),
  hostingSource: z.string().max(5).optional(),
  hostingTarget: z.string().max(5).optional(),
  legalBasis: z
    .enum(["consent", "contract", "legitimate_interest", "legal_obligation"])
    .optional(),
  schremsIiSafeguard: z
    .enum(["adequacy_decision", "scc", "bcr", "none"])
    .optional(),
  ropaEntryId: z.string().uuid().optional(),
  status: z.enum(["active", "planned", "deprecated"]).default("active"),
});

export const updateDataFlowSchema = createDataFlowSchema.partial();

// ──────────────────────────────────────────────────────────────
// Application Interface
// ──────────────────────────────────────────────────────────────

export const createInterfaceSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  interfaceType: z.enum([
    "rest_api",
    "soap",
    "graphql",
    "grpc",
    "file_transfer",
    "message_queue",
    "database_link",
    "manual",
  ]),
  direction: z.enum(["provides", "consumes"]),
  protocol: z.string().max(30).optional(),
  authentication: z
    .enum(["oauth2", "api_key", "basic", "mtls", "saml", "none"])
    .optional(),
  dataFormat: z.enum(["json", "xml", "csv", "binary", "custom"]).optional(),
  slaAvailability: z.number().min(0).max(100).optional(),
  documentationUrl: z.string().url().max(2000).optional(),
  healthCheckUrl: z.string().url().max(2000).optional(),
});

export const updateInterfaceSchema = createInterfaceSchema.partial();

// ──────────────────────────────────────────────────────────────
// Technology Radar
// ──────────────────────────────────────────────────────────────

export const createTechnologySchema = z.object({
  name: z.string().min(1).max(300),
  category: z.enum([
    "language",
    "framework",
    "database",
    "cloud_service",
    "infrastructure",
    "tool",
    "platform",
  ]),
  quadrant: z.enum([
    "languages_frameworks",
    "infrastructure",
    "data_management",
    "tools",
  ]),
  ring: z.enum(["adopt", "trial", "assess", "hold"]),
  versionInUse: z.string().max(100).optional(),
  latestVersion: z.string().max(100).optional(),
  vendor: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  rationale: z.string().max(5000).optional(),
  websiteUrl: z.string().url().max(2000).optional(),
});

export const updateTechnologySchema = createTechnologySchema.partial();

export const linkTechnologySchema = z.object({
  elementId: z.string().uuid(),
  versionUsed: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Architecture Change Request
// ──────────────────────────────────────────────────────────────

export const createAcrSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  justification: z.string().max(10000).optional(),
  changeType: z.enum([
    "add_element",
    "remove_element",
    "modify_element",
    "add_relationship",
    "migration",
  ]),
  affectedElementIds: z.array(z.string().uuid()).max(100).default([]),
  riskAssessment: z
    .enum(["low", "medium", "high", "critical"])
    .default("medium"),
  costEstimate: z.number().min(0).optional(),
  implementationDeadline: z.string().date().optional(),
});

export const updateAcrSchema = createAcrSchema.partial();

export const acrVoteSchema = z.object({
  vote: z.enum(["approve", "reject", "defer", "abstain"]),
  comment: z.string().max(5000).optional(),
});

export const acrDecisionSchema = z.object({
  status: z.enum(["approved", "rejected", "deferred"]),
  rationale: z.string().min(1).max(5000),
  conditions: z.string().max(5000).optional(),
});

// ──────────────────────────────────────────────────────────────
// RoPA Link
// ──────────────────────────────────────────────────────────────

export const linkRopaSchema = z.object({
  ropaEntryId: z.string().uuid(),
});

// ──────────────────────────────────────────────────────────────
// Health check URL validation (security)
// ──────────────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^localhost/,
  /^0\./,
];

export function isValidHealthCheckUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    return !PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
  } catch {
    return false;
  }
}
