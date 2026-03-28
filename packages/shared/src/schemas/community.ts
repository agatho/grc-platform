import { z } from "zod";

// Sprint 86: Community Edition und Open-Source Packaging — Zod schemas

export const editionTypeValues = ["community", "enterprise"] as const;

export const contributionStatusValues = [
  "submitted", "under_review", "accepted", "rejected", "merged",
] as const;

export const contributionTypeValues = [
  "plugin", "framework", "template", "translation", "documentation", "bug_fix", "feature", "rfc",
] as const;

// ──────────────────────────────────────────────────────────────
// Edition Config
// ──────────────────────────────────────────────────────────────

export const upsertCommunityEditionConfigSchema = z.object({
  editionType: z.enum(editionTypeValues).default("community"),
  enabledModules: z.array(z.string().max(50)).min(1).max(20).default(["erm", "bpm", "ics", "dms"]),
  maxUsers: z.number().int().min(1).max(10000).default(25),
  maxEntities: z.number().int().min(1).max(1000).default(3),
  pluginSdkEnabled: z.boolean().default(true),
  apiAccessEnabled: z.boolean().default(true),
  communityForumUrl: z.string().url().max(2000).optional(),
  deploymentType: z.enum(["docker_compose", "kubernetes", "native"]).default("docker_compose"),
  helmChartVersion: z.string().max(50).optional(),
  licenseKey: z.string().max(500).optional(),
  telemetryOptIn: z.boolean().default(false),
});

// ──────────────────────────────────────────────────────────────
// Contributions
// ──────────────────────────────────────────────────────────────

export const createContributionSchema = z.object({
  contributionType: z.enum(contributionTypeValues),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  repositoryUrl: z.string().url().max(2000).optional(),
  prUrl: z.string().url().max(2000).optional(),
  metadataJson: z.record(z.unknown()).default({}),
});

export const updateContributionSchema = createContributionSchema.partial();

export const reviewContributionSchema = z.object({
  status: z.enum(["accepted", "rejected", "merged"]),
  reviewNotes: z.string().max(5000).optional(),
});

export const listContributionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  contributionType: z.enum(contributionTypeValues).optional(),
  status: z.enum(contributionStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type UpsertCommunityEditionConfigInput = z.infer<typeof upsertCommunityEditionConfigSchema>;
export type CreateContributionInput = z.infer<typeof createContributionSchema>;
