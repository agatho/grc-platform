import { z } from "zod";

// Sprint 75: Regulatory Horizon Scanner Zod Schemas

// ─── Horizon Scan Source ────────────────────────────────────

export const createHorizonSourceSchema = z.object({
  name: z.string().min(1).max(500),
  sourceType: z.enum([
    "eu_oj",
    "bsi",
    "bafin",
    "enisa",
    "eba",
    "esma",
    "cert",
    "national_gazette",
    "custom",
  ]),
  url: z.string().url().max(2000).optional(),
  jurisdiction: z.string().min(1).max(100),
  regulatoryBody: z.string().max(200).optional(),
  frameworks: z.array(z.string().max(100)).max(20).optional(),
  fetchFrequencyHours: z.number().int().min(1).max(720).default(12),
  parserType: z
    .enum(["rss", "html_scraper", "api", "email", "manual"])
    .default("rss"),
  parserConfig: z.record(z.unknown()).optional(),
  nlpModel: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
});

export const updateHorizonSourceSchema = createHorizonSourceSchema.partial();

export const horizonSourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceType: z.string().max(50).optional(),
  jurisdiction: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Horizon Scan Item ──────────────────────────────────────

export const horizonItemQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  classification: z
    .enum(["critical", "high", "medium", "low", "informational"])
    .optional(),
  itemType: z
    .enum([
      "regulation",
      "directive",
      "guideline",
      "consultation",
      "enforcement",
      "standard",
      "alert",
    ])
    .optional(),
  status: z
    .enum([
      "new",
      "triaged",
      "under_review",
      "assessed",
      "acknowledged",
      "dismissed",
    ])
    .optional(),
  jurisdiction: z.string().max(100).optional(),
  since: z.string().datetime().optional(),
  framework: z.string().max(100).optional(),
});

export const updateHorizonItemSchema = z.object({
  status: z.enum([
    "new",
    "triaged",
    "under_review",
    "assessed",
    "acknowledged",
    "dismissed",
  ]),
});

// ─── Horizon Impact Assessment ──────────────────────────────

export const createHorizonImpactSchema = z.object({
  scanItemId: z.string().uuid(),
  impactLevel: z.enum(["critical", "high", "medium", "low", "none"]),
  impactAreas: z
    .array(
      z.object({
        module: z.string().max(50),
        area: z.string().max(200),
        description: z.string().max(2000),
        severity: z.enum(["critical", "high", "medium", "low"]),
      }),
    )
    .max(50)
    .optional(),
  requiredActions: z
    .array(
      z.object({
        action: z.string().max(500),
        priority: z.enum(["critical", "high", "medium", "low"]),
        deadline: z.string().optional(),
        assignee: z.string().optional(),
      }),
    )
    .max(50)
    .optional(),
  estimatedEffort: z.string().max(50).optional(),
  complianceDeadline: z.string().optional(),
});

export const updateHorizonImpactSchema = z.object({
  status: z.enum(["draft", "in_review", "approved", "rejected"]),
});

export const horizonImpactQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  impactLevel: z.enum(["critical", "high", "medium", "low", "none"]).optional(),
  status: z.enum(["draft", "in_review", "approved", "rejected"]).optional(),
});

// ─── Horizon Calendar Event ─────────────────────────────────

export const createHorizonCalendarEventSchema = z.object({
  scanItemId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  eventType: z.enum([
    "compliance_deadline",
    "enforcement_date",
    "consultation_end",
    "reporting_deadline",
    "transition_period",
  ]),
  eventDate: z.string(),
  jurisdiction: z.string().max(100).optional(),
  framework: z.string().max(100).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  reminderDays: z.number().int().min(0).max(365).default(30),
  assigneeId: z.string().uuid().optional(),
});

export const updateHorizonCalendarEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  eventDate: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const horizonCalendarQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  eventType: z.string().max(50).optional(),
  isCompleted: z.coerce.boolean().optional(),
});
