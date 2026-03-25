import { z } from "zod";

// Organization schemas (Sprint 1)
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().max(50).optional(),
  type: z.enum(["subsidiary", "holding", "joint_venture", "branch"]).default("subsidiary"),
  country: z.string().length(3).default("DEU"),
  isEu: z.boolean().default(true),
  parentOrgId: z.string().uuid().optional(),
  legalForm: z.string().max(100).optional(),
  dpoName: z.string().max(255).optional(),
  dpoEmail: z.string().email().optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// User invitation schema
export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
  department: z.string().max(255).optional(),
});

// Role assignment schema
export const assignRoleSchema = z.object({
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
});

// Invitation schemas (S1-13)
export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
});

export const acceptInvitationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).max(128).optional(),
});

// Task schemas (Sprint 1.2)
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  sourceEntityType: z.string().max(50).optional(),
  sourceEntityId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskStatusTransitionSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "overdue", "cancelled"]),
});

// Organization GDPR update schema (Sprint 1.2)
export const updateOrganizationGdprSchema = z.object({
  orgCode: z
    .string()
    .max(10)
    .regex(/^[A-Za-z0-9]*$/, "orgCode must be alphanumeric")
    .optional(),
  isDataController: z.boolean().optional(),
  dpoUserId: z.string().uuid().nullable().optional(),
  supervisoryAuthority: z.string().max(500).nullable().optional(),
  dataResidency: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, "dataResidency must be 2 uppercase letters")
    .nullable()
    .optional(),
  gdprSettings: z.record(z.unknown()).optional(),
});

// DPO assignment schema (Sprint 1.2)
export const assignDpoSchema = z.object({
  dpoUserId: z.string().uuid(),
});

// Scheduled notification schema (Sprint 1.2)
export const createScheduledNotificationSchema = z.object({
  recipientRole: z
    .enum([
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "process_owner",
      "viewer",
    ])
    .optional(),
  recipientUserIds: z.array(z.string().uuid()).optional(),
  subject: z.string().min(1).max(500),
  message: z.string().min(1),
  scheduledFor: z.string().datetime(),
  templateKey: z.string().max(100).optional(),
});

// Module config update schema (Sprint 1.3)
export const updateModuleConfigSchema = z.object({
  uiStatus: z
    .enum(["disabled", "preview", "enabled", "maintenance"])
    .optional(),
  config: z.record(z.unknown()).optional(),
});

// Notification preferences schema (Sprint 1.2)
export const updateNotificationPreferencesSchema = z.object({
  emailMode: z.enum(["immediate", "daily_digest", "disabled"]),
  digestTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "digestTime must be HH:mm format")
    .optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "quietHoursStart must be HH:mm format")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "quietHoursEnd must be HH:mm format")
    .optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 1.4: Asset & Work Item schemas
// ──────────────────────────────────────────────────────────────

const ciaScale = z.number().int().min(1).max(4);

export const createAssetSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  assetTier: z
    .enum(["business_structure", "primary_asset", "supporting_asset"])
    .default("supporting_asset"),
  codeGroup: z.string().max(100).optional(),
  defaultConfidentiality: ciaScale.nullable().optional(),
  defaultIntegrity: ciaScale.nullable().optional(),
  defaultAvailability: ciaScale.nullable().optional(),
  defaultAuthenticity: ciaScale.nullable().optional(),
  defaultReliability: ciaScale.nullable().optional(),
  contactPerson: z.string().max(255).optional(),
  dataProtectionResponsible: z.string().max(255).optional(),
  dpoEmail: z.string().email().optional(),
  latestAuditDate: z.string().optional(),
  latestAuditResult: z.string().max(50).optional(),
  parentAssetId: z.string().uuid().nullable().optional(),
  visibleInModules: z.array(z.string()).default([]),
});

export const updateAssetSchema = createAssetSchema.partial();

export const workItemStatusTransitionSchema = z.object({
  status: z.enum([
    "draft",
    "in_evaluation",
    "in_review",
    "in_approval",
    "management_approved",
    "active",
    "in_treatment",
    "completed",
    "obsolete",
    "cancelled",
  ]),
});

export const createWorkItemSchema = z.object({
  typeKey: z.string().min(1).max(50),
  name: z.string().min(1).max(500),
  status: z
    .enum([
      "draft",
      "in_evaluation",
      "in_review",
      "in_approval",
      "management_approved",
      "active",
      "in_treatment",
      "completed",
      "obsolete",
      "cancelled",
    ])
    .default("draft"),
  responsibleId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  grcPerspective: z.array(z.string()).default([]),
});

export const updateWorkItemSchema = createWorkItemSchema.partial().omit({ typeKey: true });

export const createWorkItemLinkSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  linkType: z.string().max(50).default("related"),
  linkContext: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 2: Enterprise Risk Management schemas
// ──────────────────────────────────────────────────────────────

const riskCategoryValues = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
] as const;

const riskSourceValues = [
  "isms",
  "erm",
  "bcm",
  "project",
  "process",
] as const;

const riskStatusValues = [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
] as const;

const treatmentStrategyValues = [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
] as const;

const treatmentStatusValues = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const kriDirectionValues = ["asc", "desc"] as const;
const kriMeasurementFrequencyValues = ["daily", "weekly", "monthly", "quarterly"] as const;

// ─── Risk CRUD ───────────────────────────────────────────────

export const createRiskSchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    riskCategory: z.enum(riskCategoryValues),
    riskSource: z.enum(riskSourceValues),
    ownerId: z.string().uuid().optional(),
    department: z.string().max(255).optional(),
    reviewDate: z.string().optional(),
    financialImpactMin: z.number().nonnegative().optional(),
    financialImpactMax: z.number().nonnegative().optional(),
    financialImpactExpected: z.number().nonnegative().optional(),
    // Catalog & Framework Layer hook (ADR-013)
    catalogEntryId: z.string().uuid().optional(),
    catalogSource: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      if (data.financialImpactMin != null && data.financialImpactMax != null) {
        return data.financialImpactMax >= data.financialImpactMin;
      }
      return true;
    },
    { message: "financialImpactMax must be >= financialImpactMin", path: ["financialImpactMax"] },
  );

export const updateRiskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional(),
    riskCategory: z.enum(riskCategoryValues).optional(),
    riskSource: z.enum(riskSourceValues).optional(),
    ownerId: z.string().uuid().nullable().optional(),
    department: z.string().max(255).optional(),
    reviewDate: z.string().nullable().optional(),
    financialImpactMin: z.number().nonnegative().nullable().optional(),
    financialImpactMax: z.number().nonnegative().nullable().optional(),
    financialImpactExpected: z.number().nonnegative().nullable().optional(),
    treatmentStrategy: z.enum(treatmentStrategyValues).nullable().optional(),
    treatmentRationale: z.string().nullable().optional(),
    // Catalog & Framework Layer hook (ADR-013)
    catalogEntryId: z.string().uuid().nullable().optional(),
    catalogSource: z.string().max(50).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.financialImpactMin != null && data.financialImpactMax != null) {
        return data.financialImpactMax >= data.financialImpactMin;
      }
      return true;
    },
    { message: "financialImpactMax must be >= financialImpactMin", path: ["financialImpactMax"] },
  );

// ─── Risk Assessment ─────────────────────────────────────────

const likelihoodImpactScale = z.number().int().min(1).max(5);

export const assessRiskSchema = z
  .object({
    inherentLikelihood: likelihoodImpactScale,
    inherentImpact: likelihoodImpactScale,
    residualLikelihood: likelihoodImpactScale.optional(),
    residualImpact: likelihoodImpactScale.optional(),
  })
  .refine(
    (data) => {
      const hasResL = data.residualLikelihood != null;
      const hasResI = data.residualImpact != null;
      return hasResL === hasResI;
    },
    {
      message: "residualLikelihood and residualImpact must both be provided or both omitted",
      path: ["residualLikelihood"],
    },
  );

// ─── Risk Status Transition ─────────────────────────────────

export const riskStatusTransitionSchema = z.object({
  status: z.enum(riskStatusValues),
});

// ─── Risk Treatment ──────────────────────────────────────────

export const createRiskTreatmentSchema = z.object({
  description: z.string().min(1),
  responsibleId: z.string().uuid().optional(),
  expectedRiskReduction: z.number().min(0).max(100).optional(),
  costEstimate: z.number().nonnegative().optional(),
  status: z.enum(treatmentStatusValues).default("planned"),
  dueDate: z.string().optional(),
});

export const updateRiskTreatmentSchema = createRiskTreatmentSchema.partial();

// ─── KRI ─────────────────────────────────────────────────────

export const createKriSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    riskId: z.string().uuid().optional(),
    unit: z.string().max(50).optional(),
    direction: z.enum(kriDirectionValues),
    thresholdGreen: z.number().optional(),
    thresholdYellow: z.number().optional(),
    thresholdRed: z.number().optional(),
    measurementFrequency: z.enum(kriMeasurementFrequencyValues).default("monthly"),
    alertEnabled: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (
        data.thresholdGreen != null &&
        data.thresholdYellow != null &&
        data.thresholdRed != null
      ) {
        if (data.direction === "asc") {
          // Higher is worse: green < yellow < red
          return data.thresholdGreen <= data.thresholdYellow && data.thresholdYellow <= data.thresholdRed;
        }
        // Lower is worse (desc): green > yellow > red
        return data.thresholdGreen >= data.thresholdYellow && data.thresholdYellow >= data.thresholdRed;
      }
      return true;
    },
    {
      message: "Thresholds must be ordered according to direction (asc: green <= yellow <= red, desc: green >= yellow >= red)",
      path: ["thresholdYellow"],
    },
  );

export const updateKriSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  riskId: z.string().uuid().nullable().optional(),
  unit: z.string().max(50).optional(),
  direction: z.enum(kriDirectionValues).optional(),
  thresholdGreen: z.number().nullable().optional(),
  thresholdYellow: z.number().nullable().optional(),
  thresholdRed: z.number().nullable().optional(),
  measurementFrequency: z.enum(kriMeasurementFrequencyValues).optional(),
  alertEnabled: z.boolean().optional(),
});

// ─── KRI Measurement ─────────────────────────────────────────

export const addKriMeasurementSchema = z.object({
  value: z.number(),
  measuredAt: z.string().datetime(),
  source: z.enum(["manual", "api_import", "calculated"]).default("manual"),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 3: BPMN Process Modeling schemas
// ──────────────────────────────────────────────────────────────

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
