import { z } from "zod";

// Sprint 4: Internal Control System (ICS) schemas

const controlTypeValues = ["preventive", "detective", "corrective"] as const;
const controlFreqValues = ["event_driven", "continuous", "daily", "weekly", "monthly", "quarterly", "annually", "ad_hoc"] as const;
const automationLevelValues = ["manual", "semi_automated", "fully_automated"] as const;
const controlStatusValues = ["designed", "implemented", "effective", "ineffective", "retired"] as const;
const controlAssertionValues = ["completeness", "accuracy", "obligations_and_rights", "fraud_prevention", "existence", "valuation", "presentation", "safeguarding_of_assets"] as const;
const testTypeValues = ["design_effectiveness", "operating_effectiveness"] as const;
const testResultValues = ["effective", "ineffective", "partially_effective", "not_tested"] as const;
const testStatusValues = ["planned", "in_progress", "completed", "cancelled"] as const;
const campaignStatusValues = ["draft", "active", "completed", "cancelled"] as const;
const findingSeverityValues = ["observation", "recommendation", "improvement_requirement", "insignificant_nonconformity", "significant_nonconformity"] as const;
const findingStatusValues = ["identified", "in_remediation", "remediated", "verified", "accepted", "closed"] as const;
const findingSourceValues = ["control_test", "audit", "incident", "self_assessment", "external"] as const;
const evidenceCategoryValues = ["screenshot", "document", "log_export", "email", "certificate", "report", "photo", "config_export", "other"] as const;

// ─── Status Transition Maps ──────────────────────────────────

export const VALID_CONTROL_TRANSITIONS: Record<string, string[]> = {
  designed: ["implemented", "retired"],
  implemented: ["effective", "ineffective", "retired"],
  effective: ["ineffective", "retired"],
  ineffective: ["implemented", "retired"],
  retired: [],
};

export const VALID_FINDING_TRANSITIONS: Record<string, string[]> = {
  identified: ["in_remediation", "accepted", "closed"],
  in_remediation: ["remediated", "identified"],
  remediated: ["verified", "in_remediation"],
  verified: ["closed", "in_remediation"],
  accepted: ["closed", "in_remediation"],
  closed: [],
};

export const VALID_DOCUMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review", "archived"],
  in_review: ["approved", "draft"],
  approved: ["published", "draft"],
  published: ["archived", "expired"],
  archived: ["draft"],
  expired: ["draft", "archived"],
};

// ─── Control CRUD ────────────────────────────────────────────

export const createControlSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  controlType: z.enum(controlTypeValues),
  frequency: z.enum(controlFreqValues).default("event_driven"),
  automationLevel: z.enum(automationLevelValues).default("manual"),
  assertions: z.array(z.enum(controlAssertionValues)).default([]),
  ownerId: z.string().uuid().optional(),
  department: z.string().max(255).optional(),
  objective: z.string().optional(),
  testInstructions: z.string().optional(),
  reviewDate: z.string().optional(),
  // Cost tracking
  costOnetime: z.number().nonnegative().optional(),
  costAnnual: z.number().nonnegative().optional(),
  effortHours: z.number().nonnegative().optional(),
  budgetId: z.string().uuid().optional(),
  costNote: z.string().optional(),
});

export const updateControlSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  controlType: z.enum(controlTypeValues).optional(),
  frequency: z.enum(controlFreqValues).optional(),
  automationLevel: z.enum(automationLevelValues).optional(),
  assertions: z.array(z.enum(controlAssertionValues)).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  department: z.string().max(255).optional(),
  objective: z.string().optional(),
  testInstructions: z.string().optional(),
  reviewDate: z.string().nullable().optional(),
  // Cost tracking
  costOnetime: z.number().nonnegative().nullable().optional(),
  costAnnual: z.number().nonnegative().nullable().optional(),
  effortHours: z.number().nonnegative().nullable().optional(),
  budgetId: z.string().uuid().nullable().optional(),
  costNote: z.string().nullable().optional(),
});

export const controlStatusTransitionSchema = z.object({
  status: z.enum(controlStatusValues),
});

// ─── Campaign ────────────────────────────────────────────────

export const createCampaignSchema = z
  .object({
    name: z.string().min(1).max(500),
    description: z.string().optional(),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    responsibleId: z.string().uuid().optional(),
  })
  .refine(
    (data) => data.periodEnd >= data.periodStart,
    { message: "periodEnd must be >= periodStart", path: ["periodEnd"] },
  );

// ─── Control Test ────────────────────────────────────────────

export const executeTestSchema = z.object({
  controlId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  testType: z.enum(testTypeValues),
  todResult: z.enum(testResultValues).optional(),
  toeResult: z.enum(testResultValues).optional(),
  testDate: z.string().optional(),
  sampleSize: z.number().int().positive().optional(),
  sampleDescription: z.string().optional(),
  conclusion: z.string().optional(),
});

// ─── Finding ─────────────────────────────────────────────────

export const createFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(findingSeverityValues),
  source: z.enum(findingSourceValues).default("control_test"),
  controlId: z.string().uuid().optional(),
  controlTestId: z.string().uuid().optional(),
  riskId: z.string().uuid().optional(),
  auditId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.string().optional(),
});

export const findingStatusTransitionSchema = z.object({
  status: z.enum(findingStatusValues),
});

// ─── Evidence ────────────────────────────────────────────────

export const createEvidenceSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  category: z.enum(evidenceCategoryValues).default("other"),
  fileName: z.string().min(1).max(500),
  filePath: z.string().min(1).max(1000),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(255).optional(),
  description: z.string().optional(),
});

// Sprint 4: Document Management System (DMS) schemas

const documentCategoryValues = ["policy", "procedure", "guideline", "template", "record", "tom", "dpa", "bcp", "soa", "other"] as const;
const documentStatusValues = ["draft", "in_review", "approved", "published", "archived", "expired"] as const;

// ─── Document CRUD ───────────────────────────────────────────

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  category: z.enum(documentCategoryValues).default("other"),
  requiresAcknowledgment: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  ownerId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  approverId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  category: z.enum(documentCategoryValues).optional(),
  requiresAcknowledgment: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  approverId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
});

export const documentStatusTransitionSchema = z.object({
  status: z.enum(documentStatusValues),
});

// ─── Document Entity Link ────────────────────────────────────

export const createDocumentEntityLinkSchema = z.object({
  documentId: z.string().uuid(),
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  linkDescription: z.string().optional(),
});
