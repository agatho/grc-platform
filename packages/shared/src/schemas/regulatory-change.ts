import { z } from "zod";

// Sprint 69: AI Regulatory Change Agent Zod Schemas

// ─── Regulatory Source ───────────────────────────────────────

export const createRegulatorySourceSchema = z.object({
  name: z.string().min(1).max(500),
  sourceType: z.enum([
    "official_gazette",
    "regulator",
    "industry_body",
    "eu_lex",
    "custom_feed",
  ]),
  url: z.string().url().max(2000).optional(),
  jurisdiction: z.string().min(1).max(100),
  frameworks: z.array(z.string().max(100)).max(20).optional(),
  fetchFrequencyHours: z.number().int().min(1).max(720).default(24),
  parserConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
});

export const updateRegulatorySourceSchema =
  createRegulatorySourceSchema.partial();

export const regulatorySourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  jurisdiction: z.string().max(100).optional(),
  sourceType: z.string().max(50).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Regulatory Change ───────────────────────────────────────

export const regulatoryChangeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  classification: z
    .enum(["critical", "major", "minor", "informational"])
    .optional(),
  changeType: z
    .enum(["new_regulation", "amendment", "repeal", "guidance", "enforcement"])
    .optional(),
  status: z
    .enum(["new", "under_review", "assessed", "acknowledged", "not_applicable"])
    .optional(),
  jurisdiction: z.string().max(100).optional(),
  since: z.string().datetime().optional(),
  framework: z.string().max(100).optional(),
});

export const updateRegulatoryChangeSchema = z.object({
  status: z.enum([
    "under_review",
    "assessed",
    "acknowledged",
    "not_applicable",
  ]),
});

// ─── Impact Assessment ───────────────────────────────────────

export const createImpactAssessmentSchema = z.object({
  changeId: z.string().uuid(),
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
      }),
    )
    .max(50)
    .optional(),
  estimatedEffort: z.string().max(50).optional(),
  complianceDeadline: z.string().optional(),
});

export const updateImpactAssessmentSchema = z.object({
  status: z.enum(["in_review", "approved", "rejected"]),
});

export const impactAssessmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  impactLevel: z.enum(["critical", "high", "medium", "low", "none"]).optional(),
  status: z.enum(["draft", "in_review", "approved", "rejected"]).optional(),
});

// ─── Regulatory Calendar ─────────────────────────────────────

export const createRegulatoryCalendarEventSchema = z.object({
  changeId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  eventType: z.enum([
    "compliance_deadline",
    "enforcement_date",
    "consultation_end",
    "reporting_deadline",
  ]),
  eventDate: z.string(),
  jurisdiction: z.string().max(100).optional(),
  framework: z.string().max(100).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  reminderDays: z.number().int().min(0).max(365).default(30),
  assigneeId: z.string().uuid().optional(),
});

export const updateRegulatoryCalendarEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  eventDate: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const calendarEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  eventType: z.string().max(50).optional(),
  isCompleted: z.coerce.boolean().optional(),
});

// ─── Regulatory Digest ───────────────────────────────────────

export const digestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  digestType: z.enum(["daily", "weekly", "monthly"]).optional(),
});

export const generateDigestSchema = z.object({
  digestType: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  periodStart: z.string(),
  periodEnd: z.string(),
});
