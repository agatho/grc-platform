import { z } from "zod";

// Sprint 3: BPMN Process Modeling schemas

const processNotationValues = ["bpmn", "value_chain", "epc"] as const;
const processStatusValues = ["draft", "in_review", "approved", "published", "archived"] as const;
const stepTypeValues = ["task", "gateway", "event", "subprocess", "call_activity"] as const;

// ─── Process CRUD ────────────────────────────────────────────

export const createProcessSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(500),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).default(1),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  notation: z.enum(processNotationValues).default("bpmn"),
  isEssential: z.boolean().default(false),
  reviewDate: z.string().datetime().optional().nullable(),
  reviewCycleDays: z.number().int().min(1).max(730).optional().nullable(),
});

export const updateProcessSchema = z.object({
  name: z.string().min(3).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).optional(),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  isEssential: z.boolean().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
  reviewCycleDays: z.number().int().min(1).max(730).nullable().optional(),
});

// ─── Process Version ─────────────────────────────────────────

export const createVersionSchema = z.object({
  bpmnXml: z.string().min(50, "BPMN XML too short to be valid"),
  changeSummary: z.string().max(500).optional(),
});

// ─── Process Status Transition ───────────────────────────────

export const transitionProcessStatusSchema = z.object({
  status: z.enum(processStatusValues),
  comment: z.string().max(1000).optional(),
});

// ─── Risk Linkage ────────────────────────────────────────────

export const linkProcessRiskSchema = z.object({
  riskId: z.string().uuid(),
  riskContext: z.string().max(1000).optional(),
});

// ─── AI BPMN Generation ──────────────────────────────────────

export const generateBpmnSchema = z.object({
  name: z.string().min(3).max(200),
  description: z
    .string()
    .min(50, "Description must be at least 50 characters for good results")
    .max(2000),
  industry: z
    .enum(["manufacturing", "it_services", "financial_services", "healthcare", "generic"])
    .default("generic"),
});

// ─── Process Step Update ─────────────────────────────────────

export const updateProcessStepSchema = z.object({
  responsibleRole: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

// ─── Asset Linkage (Gap 1) ────────────────────────────────────

export const linkProcessAssetSchema = z.object({
  assetId: z.string().uuid(),
});

// ─── Control Linkage (Gap 3) ──────────────────────────────────

export const linkProcessControlSchema = z.object({
  controlId: z.string().uuid(),
  controlContext: z.string().max(1000).optional(),
});

// ─── Document Linkage (Gap 4) ─────────────────────────────────

export const linkProcessDocumentSchema = z.object({
  documentId: z.string().uuid(),
  documentType: z.enum(["policy", "procedure", "guideline", "sop", "form"]).optional(),
  linkContext: z.string().max(1000).optional(),
});

// Sprint 3b: Process Governance schemas

// ─── Comment CRUD ─────────────────────────────────────────────

export const createCommentSchema = z.object({
  processId: z.string().uuid(),
  entityType: z.enum(["process", "process_step"]).default("process"),
  entityId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(5000),
  parentCommentId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
  isResolved: z.boolean().optional(),
});

export const commentListQuerySchema = z.object({
  processId: z.string().uuid(),
  entityType: z.enum(["process", "process_step"]).optional(),
  entityId: z.string().uuid().optional(),
  isResolved: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default("50"),
});

// ─── Review Schedule ──────────────────────────────────────────

export const createReviewScheduleSchema = z.object({
  processId: z.string().uuid(),
  reviewIntervalMonths: z.number().int().min(1).max(60),
  nextReviewDate: z.string().min(1, "Next review date is required"),
  assignedReviewerId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

// ─── Bulk Operations ──────────────────────────────────────────

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_status"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(processStatusValues),
    comment: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("assign_owner"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    processOwnerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign_reviewer"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    reviewerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("change_department"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    department: z.string().max(255),
  }),
  z.object({
    action: z.literal("delete"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
  }),
]);

// ─── Version Compare ─────────────────────────────────────────

export const versionCompareQuerySchema = z.object({
  processId: z.string().uuid(),
  versionA: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1)),
  versionB: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1)),
});

// ─── BPMN Validation Config ──────────────────────────────────

const validationRuleLevelValues = ["error", "warning", "disabled"] as const;

export const bpmnValidationConfigSchema = z.object({
  missingStartEvent: z.enum(validationRuleLevelValues).default("error"),
  missingEndEvent: z.enum(validationRuleLevelValues).default("error"),
  disconnectedElements: z.enum(validationRuleLevelValues).default("error"),
  gatewayMissingDefault: z.enum(validationRuleLevelValues).default("warning"),
});
