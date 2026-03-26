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

// ──────────────────────────────────────────────────────────────
// Sprint 3b: Process Governance schemas
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Sprint 4b: Catalog & Framework Layer schemas
// ──────────────────────────────────────────────────────────────

const catalogObjectTypeValues = ["it_system", "application", "role", "department", "location", "vendor", "standard", "regulation", "custom"] as const;
const methodologyTypeValues = ["iso_31000", "coso_erm", "fair", "custom"] as const;
const enforcementLevelValues = ["optional", "recommended", "mandatory"] as const;

// ─── General Catalog Entry CRUD ──────────────────────────────

export const createGeneralCatalogEntrySchema = z.object({
  objectType: z.enum(catalogObjectTypeValues),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.string().max(50).default("active"),
  lifecycleStart: z.string().optional(),
  lifecycleEnd: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  metadataJson: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
});

export const updateGeneralCatalogEntrySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.string().max(50).optional(),
  lifecycleStart: z.string().nullable().optional(),
  lifecycleEnd: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  metadataJson: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

// ─── Methodology ──────────────────────────────────────────────

export const setMethodologySchema = z.object({
  methodology: z.enum(methodologyTypeValues).default("iso_31000"),
  matrixSize: z.number().int().min(3).max(10).default(5),
  fairCurrency: z.string().max(10).default("EUR"),
  fairSimulationRuns: z.number().int().min(100).max(1000000).default(10000),
  riskAppetiteThreshold: z.number().int().min(1).max(100).optional(),
  customLabelsJson: z.record(z.unknown()).optional(),
});

// ─── Activate Catalog ─────────────────────────────────────────

export const activateCatalogSchema = z.object({
  catalogType: z.enum(["risk", "control"]),
  catalogId: z.string().uuid(),
  enforcementLevel: z.enum(enforcementLevelValues).default("optional"),
  isMandatoryFromParent: z.boolean().default(false),
});

// ─── Lifecycle Phase ──────────────────────────────────────────

export const createLifecyclePhaseSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  phaseName: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Custom Catalog Entry (risk/control) ──────────────────────

export const createCustomCatalogEntrySchema = z.object({
  catalogId: z.string().uuid(),
  parentEntryId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  titleDe: z.string().min(1).max(500),
  titleEn: z.string().max(500).optional(),
  descriptionDe: z.string().optional(),
  descriptionEn: z.string().optional(),
  level: z.number().int().min(1).max(4),
  sortOrder: z.number().int().default(0),
  metadataJson: z.record(z.unknown()).optional(),
});

// ─── Catalog Browser Query ────────────────────────────────────

export const catalogBrowserQuerySchema = z.object({
  catalogType: z.enum(["risk", "control"]).optional(),
  catalogId: z.string().uuid().optional(),
  level: z.string().transform(Number).pipe(z.number().int().min(1).max(4)).optional(),
  parentEntryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(200)).default("50"),
});

// ──────────────────────────────────────────────────────────────
// Sprint 4: Internal Control System (ICS) schemas
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Sprint 4: Document Management System (DMS) schemas
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Sprint 5a: ISMS — Assets, Protection Requirements & Incidents
// ──────────────────────────────────────────────────────────────

export const protectionLevel = z.enum(["normal", "high", "very_high"]);
export const incidentSeverity = z.enum(["low", "medium", "high", "critical"]);
export const incidentStatus = z.enum([
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
]);
export const dependencyType = z.enum(["uses", "produces", "manages", "depends_on"]);
export const ismsObjectCriticality = z.enum(["low", "medium", "high", "critical"]);

// ─── Asset Classification (PRQ) ─────────────────────────────

export const classifyAssetSchema = z.object({
  confidentialityLevel: protectionLevel,
  confidentialityReason: z.string().max(2000).optional(),
  integrityLevel: protectionLevel,
  integrityReason: z.string().max(2000).optional(),
  availabilityLevel: protectionLevel,
  availabilityReason: z.string().max(2000).optional(),
  reviewDate: z.string().date().optional(),
});

// ─── Process-Asset Linkage (EAM) ────────────────────────────

export const createProcessAssetSchema = z.object({
  processId: z.string().uuid(),
  assetId: z.string().uuid(),
  dependencyType: dependencyType.default("uses"),
  criticality: ismsObjectCriticality.default("medium"),
  notes: z.string().max(2000).optional(),
});

// ─── Threats ─────────────────────────────────────────────────

export const createThreatSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  threatCategory: z.string().max(100).optional(),
  likelihoodRating: z.number().int().min(1).max(5).optional(),
  catalogEntryId: z.string().uuid().optional(),
});

// ─── Vulnerabilities ─────────────────────────────────────────

export const createVulnerabilitySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  cveReference: z.string().max(50).optional(),
  affectedAssetId: z.string().uuid().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  mitigationControlId: z.string().uuid().optional(),
});

// ─── Risk Scenarios ──────────────────────────────────────────

export const createRiskScenarioSchema = z.object({
  threatId: z.string().uuid(),
  vulnerabilityId: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  riskId: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
});

// ─── Security Incidents ──────────────────────────────────────

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  severity: incidentSeverity.default("medium"),
  incidentType: z.string().max(100).optional(),
  detectedAt: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
  affectedAssetIds: z.array(z.string().uuid()).default([]),
  affectedProcessIds: z.array(z.string().uuid()).default([]),
  isDataBreach: z.boolean().default(false),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  severity: incidentSeverity.optional(),
  incidentType: z.string().max(100).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  affectedAssetIds: z.array(z.string().uuid()).optional(),
  affectedProcessIds: z.array(z.string().uuid()).optional(),
  isDataBreach: z.boolean().optional(),
  rootCause: z.string().max(10000).optional(),
  remediationActions: z.string().max(10000).optional(),
  lessonsLearned: z.string().max(10000).optional(),
});

// ─── Incident Status Transition ──────────────────────────────

export const incidentStatusTransitions: Record<string, string[]> = {
  detected: ["triaged"],
  triaged: ["contained", "eradicated"],
  contained: ["eradicated"],
  eradicated: ["recovered"],
  recovered: ["lessons_learned"],
  lessons_learned: ["closed"],
  closed: ["detected"], // reopen
};

export function isValidIncidentTransition(from: string, to: string): boolean {
  return incidentStatusTransitions[from]?.includes(to) ?? false;
}

export const incidentStatusTransitionSchema = z.object({
  status: incidentStatus,
});

// ─── Incident Timeline ───────────────────────────────────────

export const createIncidentTimelineEntrySchema = z.object({
  actionType: z.enum([
    "detection",
    "triage",
    "containment",
    "communication",
    "escalation",
    "recovery",
    "eradication",
    "lessons_learned",
    "other",
  ]),
  description: z.string().min(1).max(5000),
  occurredAt: z.string().datetime().optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 5b: ISMS Assessment schemas
// ──────────────────────────────────────────────────────────────

const assessmentStatusValues = ["planning", "in_progress", "review", "completed", "cancelled"] as const;
const assessmentScopeTypeValues = ["full", "department", "asset_group", "custom"] as const;
const evalResultValues = ["effective", "partially_effective", "ineffective", "not_applicable", "not_evaluated"] as const;
const riskDecisionValues = ["accept", "mitigate", "transfer", "avoid", "pending"] as const;
const soaApplicabilityValues = ["applicable", "not_applicable", "partially_applicable"] as const;
const soaImplementationValues = ["implemented", "partially_implemented", "planned", "not_implemented"] as const;
const reviewStatusValues = ["planned", "in_progress", "completed", "cancelled"] as const;

const maturityScale = z.number().int().min(1).max(5);

// ─── Assessment Run ────────────────────────────────────────────

export const createAssessmentRunSchema = z
  .object({
    name: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    scopeType: z.enum(assessmentScopeTypeValues).default("full"),
    scopeFilter: z.record(z.unknown()).optional(),
    framework: z.string().max(100).default("iso27001"),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    leadAssessorId: z.string().uuid().optional(),
  })
  .refine(
    (data) => data.periodEnd >= data.periodStart,
    { message: "periodEnd must be >= periodStart", path: ["periodEnd"] },
  );

// ─── Control Evaluation ────────────────────────────────────────

export const submitControlEvalSchema = z.object({
  controlId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  result: z.enum(evalResultValues),
  evidence: z.string().max(10000).optional(),
  notes: z.string().max(5000).optional(),
  evidenceDocumentIds: z.array(z.string().uuid()).default([]),
  currentMaturity: maturityScale.optional(),
  targetMaturity: maturityScale.optional(),
});

// ─── Risk Evaluation ───────────────────────────────────────────

export const submitRiskEvalSchema = z.object({
  riskScenarioId: z.string().uuid(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  decision: z.enum(riskDecisionValues),
  justification: z.string().max(5000).optional(),
});

// ─── SoA (Statement of Applicability) ──────────────────────────

export const updateSoaEntrySchema = z.object({
  controlId: z.string().uuid().nullable().optional(),
  applicability: z.enum(soaApplicabilityValues).optional(),
  applicabilityJustification: z.string().max(5000).optional(),
  implementation: z.enum(soaImplementationValues).optional(),
  implementationNotes: z.string().max(5000).optional(),
  responsibleId: z.string().uuid().nullable().optional(),
});

export const bulkUpdateSoaSchema = z.object({
  entries: z
    .array(
      z.object({
        catalogEntryId: z.string().uuid(),
        controlId: z.string().uuid().nullable().optional(),
        applicability: z.enum(soaApplicabilityValues).optional(),
        applicabilityJustification: z.string().max(5000).optional(),
        implementation: z.enum(soaImplementationValues).optional(),
        implementationNotes: z.string().max(5000).optional(),
        responsibleId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

// ─── Management Review ─────────────────────────────────────────

export const createManagementReviewSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  reviewDate: z.string().min(1),
  chairId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  nextReviewDate: z.string().optional(),
});

export const updateManagementReviewSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  reviewDate: z.string().optional(),
  status: z.enum(reviewStatusValues).optional(),
  chairId: z.string().uuid().nullable().optional(),
  participantIds: z.array(z.string().uuid()).optional(),
  changesInContext: z.string().max(10000).optional(),
  performanceFeedback: z.string().max(10000).optional(),
  riskAssessmentResults: z.string().max(10000).optional(),
  auditResults: z.string().max(10000).optional(),
  improvementOpportunities: z.string().max(10000).optional(),
  decisions: z.record(z.unknown()).optional(),
  actionItems: z.record(z.unknown()).optional(),
  minutes: z.string().max(50000).optional(),
  nextReviewDate: z.string().nullable().optional(),
});

// ─── Maturity Rating ───────────────────────────────────────────

export const rateMaturitySchema = z.object({
  controlId: z.string().uuid(),
  assessmentRunId: z.string().uuid().optional(),
  currentMaturity: maturityScale,
  targetMaturity: maturityScale,
  justification: z.string().max(5000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 6: Business Continuity Management System (BCMS) schemas
// ──────────────────────────────────────────────────────────────

// ──────────── BIA ────────────

export const createBiaAssessmentSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  leadAssessorId: z.string().uuid().optional(),
});

export const submitBiaProcessImpactSchema = z
  .object({
    processId: z.string().uuid(),
    mtpdHours: z.number().int().min(0).optional(),
    rtoHours: z.number().int().min(0).optional(),
    rpoHours: z.number().int().min(0).optional(),
    impact1h: z.number().optional(),
    impact4h: z.number().optional(),
    impact24h: z.number().optional(),
    impact72h: z.number().optional(),
    impact1w: z.number().optional(),
    impact1m: z.number().optional(),
    impactReputation: z.number().int().min(1).max(5).optional(),
    impactLegal: z.number().int().min(1).max(5).optional(),
    impactOperational: z.number().int().min(1).max(5).optional(),
    impactFinancial: z.number().int().min(1).max(5).optional(),
    impactSafety: z.number().int().min(1).max(5).optional(),
    criticalResources: z.string().optional(),
    minimumStaff: z.number().int().min(0).optional(),
    alternateLocation: z.string().max(500).optional(),
    peakPeriods: z.string().optional(),
    isEssential: z.boolean().default(false),
  })
  .refine(
    (d) => !d.rtoHours || !d.mtpdHours || d.rtoHours <= d.mtpdHours,
    { message: "RTO must be <= MTPD" },
  );

export const biaStatusTransitions: Record<string, string[]> = {
  draft: ["in_progress"],
  in_progress: ["review"],
  review: ["approved", "in_progress"],
  approved: ["archived"],
  archived: [],
};

// ──────────── BCP ────────────

export const createBcpSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  scope: z.string().optional(),
  processIds: z.array(z.string().uuid()).default([]),
  bcManagerId: z.string().uuid().optional(),
  activationCriteria: z.string().optional(),
  activationAuthority: z.string().max(255).optional(),
});

export const bcpStatusTransitions: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["published"],
  published: ["archived", "superseded"],
  archived: [],
  superseded: [],
};

export const createBcpProcedureSchema = z.object({
  stepNumber: z.number().int().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  responsibleRole: z.string().max(255).optional(),
  responsibleId: z.string().uuid().optional(),
  estimatedDurationMinutes: z.number().int().min(0).optional(),
  requiredResources: z.string().optional(),
  prerequisites: z.string().optional(),
  successCriteria: z.string().optional(),
});

export const createBcpResourceSchema = z.object({
  resourceType: z.enum([
    "people",
    "it_system",
    "facility",
    "supplier",
    "equipment",
    "data",
    "other",
  ]),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  assetId: z.string().uuid().optional(),
  isAvailableOffsite: z.boolean().default(false),
  alternativeResource: z.string().max(500).optional(),
  priority: z.enum(["required", "nice_to_have"]).default("required"),
});

// ──────────── Crisis ────────────

export const createCrisisScenarioSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.enum([
    "cyber_attack",
    "fire",
    "pandemic",
    "supply_chain",
    "natural_disaster",
    "it_outage",
    "other",
  ]),
  severity: z
    .enum([
      "level_1_incident",
      "level_2_emergency",
      "level_3_crisis",
      "level_4_catastrophe",
    ])
    .default("level_2_emergency"),
  bcpId: z.string().uuid().optional(),
  escalationMatrix: z
    .array(
      z.object({
        level: z.number().int().min(1).max(4),
        triggerCriteria: z.string(),
        notifyRoles: z.array(z.string()),
        autoNotify: z.boolean().default(true),
      }),
    )
    .default([]),
  communicationTemplate: z.string().optional(),
});

export const activateCrisisSchema = z.object({
  scenarioId: z.string().uuid(),
  initialAssessment: z.string().optional(),
});

export const addCrisisLogEntrySchema = z.object({
  entryType: z.enum([
    "decision",
    "communication",
    "action",
    "status_change",
    "observation",
  ]),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
});

// ──────────── Continuity Strategy ────────────

export const createContinuityStrategySchema = z.object({
  processId: z.string().uuid(),
  strategyType: z.enum([
    "active_active",
    "active_passive",
    "cold_standby",
    "manual_workaround",
    "outsource",
    "do_nothing",
  ]),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  rtoTargetHours: z.number().int().min(0),
  estimatedCostEur: z.number().min(0).optional(),
  annualCostEur: z.number().min(0).optional(),
  requiredStaff: z.number().int().min(0).optional(),
  requiredSystems: z.string().optional(),
  alternateLocation: z.string().max(500).optional(),
});

// ──────────── BC Exercise ────────────

export const createBcExerciseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  exerciseType: z.enum([
    "tabletop",
    "walkthrough",
    "functional",
    "full_simulation",
  ]),
  crisisScenarioId: z.string().uuid().optional(),
  bcpId: z.string().uuid().optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedDurationHours: z.number().int().min(1).optional(),
  exerciseLeadId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  objectives: z
    .array(
      z.object({
        title: z.string(),
        met: z.boolean().default(false),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

export const completeExerciseSchema = z.object({
  actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualDurationHours: z.number().int().min(0),
  overallResult: z.enum(["successful", "partially_successful", "failed"]),
  lessonsLearned: z.string().optional(),
  objectives: z.array(
    z.object({
      title: z.string(),
      met: z.boolean(),
      notes: z.string().optional(),
    }),
  ),
});

export const createExerciseFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(["critical", "major", "minor", "observation"]),
  recommendation: z.string().optional(),
});

// ──────────── Update schemas ────────────

export const updateBiaAssessmentSchema = createBiaAssessmentSchema.partial();

export const updateBcpSchema = createBcpSchema.partial();
export const updateBcpProcedureSchema = createBcpProcedureSchema.partial();

export const updateCrisisScenarioSchema = createCrisisScenarioSchema.partial();

export const updateContinuityStrategySchema = createContinuityStrategySchema.partial();

export const updateBcExerciseSchema = createBcExerciseSchema.partial();

// ──────────── Crisis Team Member ────────────

export const addCrisisTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["crisis_lead", "communication", "technical", "logistics", "legal"]),
  isPrimary: z.boolean().default(true),
  deputyUserId: z.string().uuid().optional(),
  phoneNumber: z.string().max(50).optional(),
});

// ──────────── BIA Supplier Dependency ────────────

export const createBiaSupplierDependencySchema = z.object({
  supplierName: z.string().min(1).max(500),
  service: z.string().max(500).optional(),
  isCritical: z.boolean().default(false),
  alternativeAvailable: z.boolean().default(false),
  switchoverTimeHours: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// ──────────── BCP Status Transition ────────────

export const bcpStatusTransitionSchema = z.object({
  status: z.enum(["draft", "in_review", "approved", "published", "archived", "superseded"]),
});

// ──────────────────────────────────────────────────────────────
// Sprint 7: Data Protection Management System (DPMS) schemas
// ──────────────────────────────────────────────────────────────

const ropaLegalBasisValues = ["consent", "contract", "legal_obligation", "vital_interest", "public_interest", "legitimate_interest"] as const;
const ropaStatusValues = ["draft", "active", "under_review", "archived"] as const;
const dpiaStatusValues = ["draft", "in_progress", "completed", "pending_dpo_review", "approved", "rejected"] as const;
const dsrTypeValues = ["access", "erasure", "restriction", "portability", "objection"] as const;
const dsrStatusValues = ["received", "verified", "processing", "response_sent", "closed", "rejected"] as const;
const breachSeverityValues = ["low", "medium", "high", "critical"] as const;
const breachStatusValues = ["detected", "assessing", "notifying_dpa", "notifying_individuals", "remediation", "closed"] as const;
const tiaLegalBasisValues = ["adequacy", "sccs", "bcrs", "derogation"] as const;
const tiaRiskRatingValues = ["low", "medium", "high"] as const;

// ──────────── ROPA ────────────

export const createRopaEntrySchema = z.object({
  title: z.string().min(1).max(500),
  purpose: z.string().min(1),
  legalBasis: z.enum(ropaLegalBasisValues),
  legalBasisDetail: z.string().optional(),
  controllerOrgId: z.string().uuid().optional(),
  processorName: z.string().max(500).optional(),
  processingDescription: z.string().optional(),
  retentionPeriod: z.string().max(255).optional(),
  retentionJustification: z.string().optional(),
  technicalMeasures: z.string().optional(),
  organizationalMeasures: z.string().optional(),
  internationalTransfer: z.boolean().default(false),
  transferCountry: z.string().max(100).optional(),
  transferSafeguard: z.string().max(100).optional(),
  responsibleId: z.string().uuid().optional(),
  nextReviewDate: z.string().optional(),
});

export const updateRopaEntrySchema = createRopaEntrySchema.partial();

export const ropaStatusTransitionSchema = z.object({
  status: z.enum(ropaStatusValues),
});

export const VALID_ROPA_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "under_review"],
  active: ["under_review", "archived"],
  under_review: ["active", "archived"],
  archived: ["draft"],
};

export const createRopaDataCategorySchema = z.object({
  category: z.string().min(1).max(255),
});

export const createRopaDataSubjectSchema = z.object({
  subjectCategory: z.string().min(1).max(255),
});

export const createRopaRecipientSchema = z.object({
  recipientName: z.string().min(1).max(500),
  recipientType: z.string().max(100).optional(),
});

// ──────────── DPIA ────────────

export const createDpiaSchema = z.object({
  title: z.string().min(1).max(500),
  processingDescription: z.string().optional(),
  legalBasis: z.enum(ropaLegalBasisValues).optional(),
  necessityAssessment: z.string().optional(),
  dpoConsultationRequired: z.boolean().default(false),
});

export const updateDpiaSchema = createDpiaSchema.partial();

export const dpiaStatusTransitionSchema = z.object({
  status: z.enum(dpiaStatusValues),
});

export const VALID_DPIA_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_progress"],
  in_progress: ["completed", "pending_dpo_review"],
  completed: ["pending_dpo_review", "draft"],
  pending_dpo_review: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

export const createDpiaRiskSchema = z.object({
  riskDescription: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  likelihood: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  impact: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export const createDpiaMeasureSchema = z.object({
  measureDescription: z.string().min(1),
  implementationTimeline: z.string().max(255).optional(),
});

// ──────────── DSR ────────────

export const createDsrSchema = z.object({
  requestType: z.enum(dsrTypeValues),
  subjectName: z.string().min(1).max(255),
  subjectEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

export const updateDsrSchema = z.object({
  subjectName: z.string().min(1).max(255).optional(),
  subjectEmail: z.string().email().optional(),
  notes: z.string().optional(),
  handlerId: z.string().uuid().nullable().optional(),
});

export const dsrStatusTransitionSchema = z.object({
  status: z.enum(dsrStatusValues),
});

export const DSR_STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ["verified", "rejected"],
  verified: ["processing"],
  processing: ["response_sent"],
  response_sent: ["closed"],
  rejected: ["closed"],
  closed: [],
};

export function isValidDsrTransition(from: string, to: string): boolean {
  return DSR_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const createDsrActivitySchema = z.object({
  activityType: z.enum([
    "identity_verification",
    "data_collection",
    "data_review",
    "response_draft",
    "response_sent",
    "extension_requested",
    "note",
    "other",
  ]),
  details: z.string().optional(),
});

// ──────────── Data Breach ────────────

export const createDataBreachSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(breachSeverityValues).default("medium"),
  detectedAt: z.string().datetime(),
  incidentId: z.string().uuid().optional(),
  dataCategoriesAffected: z.array(z.string()).default([]),
  estimatedRecordsAffected: z.number().int().nonnegative().optional(),
  affectedCountries: z.array(z.string()).default([]),
  isDpaNotificationRequired: z.boolean().default(true),
  isIndividualNotificationRequired: z.boolean().default(false),
  containmentMeasures: z.string().optional(),
  dpoId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const updateDataBreachSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  severity: z.enum(breachSeverityValues).optional(),
  dataCategoriesAffected: z.array(z.string()).optional(),
  estimatedRecordsAffected: z.number().int().nonnegative().nullable().optional(),
  affectedCountries: z.array(z.string()).optional(),
  isDpaNotificationRequired: z.boolean().optional(),
  isIndividualNotificationRequired: z.boolean().optional(),
  containmentMeasures: z.string().optional(),
  remediationMeasures: z.string().optional(),
  lessonsLearned: z.string().optional(),
  dpoId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export const breachStatusTransitionSchema = z.object({
  status: z.enum(breachStatusValues),
});

export const BREACH_STATUS_TRANSITIONS: Record<string, string[]> = {
  detected: ["assessing"],
  assessing: ["notifying_dpa", "remediation"],
  notifying_dpa: ["notifying_individuals", "remediation"],
  notifying_individuals: ["remediation"],
  remediation: ["closed"],
  closed: [],
};

export function isValidBreachTransition(from: string, to: string): boolean {
  return BREACH_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const createDataBreachNotificationSchema = z.object({
  recipientType: z.enum(["dpa", "individual", "processor", "controller", "other"]),
  recipientEmail: z.string().email().optional(),
});

// ──────────── TIA ────────────

export const createTiaSchema = z.object({
  title: z.string().min(1).max(500),
  transferCountry: z.string().min(1).max(100),
  legalBasis: z.enum(tiaLegalBasisValues),
  schremsIiAssessment: z.string().optional(),
  riskRating: z.enum(tiaRiskRatingValues).default("medium"),
  supportingDocuments: z.string().optional(),
  responsibleId: z.string().uuid().optional(),
  assessmentDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
});

export const updateTiaSchema = createTiaSchema.partial();

// ──────────────────────────────────────────────────────────────
// Sprint 8: Audit Management schemas
// ──────────────────────────────────────────────────────────────

const auditTypeValues = ["internal", "external", "certification", "surveillance", "follow_up"] as const;
const auditStatusValues = ["planned", "preparation", "fieldwork", "reporting", "review", "completed", "cancelled"] as const;
const auditPlanStatusValues = ["draft", "approved", "active", "completed"] as const;
const checklistResultValues = ["conforming", "nonconforming", "observation", "not_applicable"] as const;
const auditConclusionValues = ["conforming", "minor_nonconformity", "major_nonconformity", "not_applicable"] as const;
const universeEntityTypeValues = ["process", "department", "it_system", "vendor", "custom"] as const;
const checklistSourceTypeValues = ["auto_controls", "template", "custom"] as const;

// ─── Audit Status Transitions ────────────────────────────────

export const VALID_AUDIT_STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["preparation", "cancelled"],
  preparation: ["fieldwork", "planned", "cancelled"],
  fieldwork: ["reporting", "cancelled"],
  reporting: ["review", "cancelled"],
  review: ["completed", "reporting"],
  completed: [],
  cancelled: [],
};

export function isValidAuditTransition(from: string, to: string): boolean {
  return VALID_AUDIT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Audit Universe Entry ────────────────────────────────────

export const createAuditUniverseEntrySchema = z.object({
  name: z.string().min(1).max(500),
  entityType: z.enum(universeEntityTypeValues),
  entityId: z.string().uuid().optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  lastAuditDate: z.string().optional(),
  auditCycleMonths: z.number().int().min(1).max(120).default(12),
  nextAuditDue: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const updateAuditUniverseEntrySchema = createAuditUniverseEntrySchema.partial();

// ─── Audit Plan ──────────────────────────────────────────────

export const createAuditPlanSchema = z.object({
  name: z.string().min(1).max(500),
  year: z.number().int().min(2020).max(2100),
  description: z.string().optional(),
  totalPlannedDays: z.number().int().positive().optional(),
});

export const updateAuditPlanSchema = createAuditPlanSchema.partial();

// ─── Audit Plan Item ─────────────────────────────────────────

export const createAuditPlanItemSchema = z.object({
  auditPlanId: z.string().uuid(),
  universeEntryId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  scopeDescription: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  estimatedDays: z.number().int().positive().optional(),
  leadAuditorId: z.string().uuid().optional(),
});

// ─── Audit ───────────────────────────────────────────────────

export const createAuditSchema = z.object({
  auditPlanItemId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  auditType: z.enum(auditTypeValues).default("internal"),
  scopeDescription: z.string().optional(),
  scopeProcesses: z.array(z.string()).optional(),
  scopeDepartments: z.array(z.string()).optional(),
  scopeFrameworks: z.array(z.string()).optional(),
  leadAuditorId: z.string().uuid().optional(),
  auditorIds: z.array(z.string().uuid()).optional(),
  auditeeId: z.string().uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export const updateAuditSchema = createAuditSchema.partial();

export const auditStatusTransitionSchema = z.object({
  status: z.enum(auditStatusValues),
  conclusion: z.enum(auditConclusionValues).optional(),
});

// ─── Audit Checklist ─────────────────────────────────────────

export const createAuditChecklistSchema = z.object({
  auditId: z.string().uuid(),
  name: z.string().min(1).max(500),
  sourceType: z.enum(checklistSourceTypeValues).optional(),
});

// ─── Checklist Item Evaluation ───────────────────────────────

export const evaluateChecklistItemSchema = z.object({
  result: z.enum(checklistResultValues),
  notes: z.string().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),
});

// ──────────────────────────────────────────────────────────────
// Sprint 9: TPRM + Contract Management schemas
// ──────────────────────────────────────────────────────────────

const vendorStatusValues = ["prospect", "onboarding", "active", "under_review", "suspended", "terminated"] as const;
const vendorTierValues = ["critical", "important", "standard", "low_risk"] as const;
const vendorCategoryValues = ["it_services", "cloud_provider", "consulting", "facility", "logistics", "raw_materials", "financial", "hr_services", "other"] as const;
const ddStatusValues = ["pending", "in_progress", "completed", "expired"] as const;
const contractStatusValues = ["draft", "negotiation", "pending_approval", "active", "renewal", "expired", "terminated", "archived"] as const;
const contractTypeValues = ["master_agreement", "service_agreement", "nda", "dpa", "sla", "license", "maintenance", "consulting", "other"] as const;
const obligationStatusValues = ["pending", "in_progress", "completed", "overdue"] as const;
const obligationTypeValues = ["deliverable", "payment", "reporting", "compliance", "audit_right"] as const;

// ─── Vendor Status Transitions ───────────────────────────────

export const VALID_VENDOR_TRANSITIONS: Record<string, string[]> = {
  prospect: ["onboarding", "terminated"],
  onboarding: ["active", "suspended", "terminated"],
  active: ["under_review", "suspended", "terminated"],
  under_review: ["active", "suspended", "terminated"],
  suspended: ["active", "under_review", "terminated"],
  terminated: [],
};

export const VALID_CONTRACT_TRANSITIONS: Record<string, string[]> = {
  draft: ["negotiation", "pending_approval", "archived"],
  negotiation: ["pending_approval", "draft", "archived"],
  pending_approval: ["active", "negotiation", "archived"],
  active: ["renewal", "terminated", "expired"],
  renewal: ["active", "terminated", "expired"],
  expired: ["renewal", "archived"],
  terminated: ["archived"],
  archived: [],
};

// ─── Vendor CRUD ─────────────────────────────────────────────

export const createVendorSchema = z.object({
  name: z.string().min(1).max(500),
  legalName: z.string().max(500).optional(),
  description: z.string().optional(),
  category: z.enum(vendorCategoryValues).default("other"),
  tier: z.enum(vendorTierValues).default("standard"),
  country: z.string().max(100).optional(),
  address: z.string().optional(),
  website: z.string().max(500).optional(),
  taxId: z.string().max(100).optional(),
  isLksgRelevant: z.boolean().default(false),
  lksgTier: z.string().max(20).optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  legalName: z.string().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.enum(vendorCategoryValues).optional(),
  tier: z.enum(vendorTierValues).optional(),
  country: z.string().max(100).nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  taxId: z.string().max(100).nullable().optional(),
  isLksgRelevant: z.boolean().optional(),
  lksgTier: z.string().max(20).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

export const vendorStatusTransitionSchema = z.object({
  status: z.enum(vendorStatusValues),
});

// ─── Vendor Contact ──────────────────────────────────────────

export const createVendorContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  role: z.string().max(255).optional(),
  isPrimary: z.boolean().default(false),
});

export const updateVendorContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  role: z.string().max(255).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

// ─── Vendor Risk Assessment ──────────────────────────────────

export const createVendorRiskAssessmentSchema = z.object({
  assessmentDate: z.string().min(1),
  inherentRiskScore: z.number().int().min(1).max(25),
  residualRiskScore: z.number().int().min(1).max(25),
  confidentialityScore: z.number().int().min(1).max(5).optional(),
  integrityScore: z.number().int().min(1).max(5).optional(),
  availabilityScore: z.number().int().min(1).max(5).optional(),
  complianceScore: z.number().int().min(1).max(5).optional(),
  financialScore: z.number().int().min(1).max(5).optional(),
  reputationScore: z.number().int().min(1).max(5).optional(),
  controlsApplied: z.array(z.record(z.unknown())).optional(),
  riskTrend: z.enum(["improving", "stable", "deteriorating"]).optional(),
  notes: z.string().optional(),
});

// ─── Vendor Due Diligence ────────────────────────────────────

export const createDueDiligenceSchema = z.object({
  questionnaireVersion: z.string().max(50).optional(),
});

export const completeDueDiligenceSchema = z.object({
  responses: z.record(z.unknown()),
  riskScore: z.number().int().min(0).max(100).optional(),
});

export const reviewDueDiligenceSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
});

// ─── DD Questions ────────────────────────────────────────────

export const createDdQuestionSchema = z.object({
  category: z.string().min(1).max(100),
  questionText: z.string().min(1),
  answerType: z.enum(["text", "yes_no", "scale", "multi_choice", "file_upload"]).default("text"),
  riskWeighting: z.number().min(0).max(10).optional(),
  sortOrder: z.number().int().default(0),
});

export const updateDdQuestionSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  questionText: z.string().min(1).optional(),
  answerType: z.enum(["text", "yes_no", "scale", "multi_choice", "file_upload"]).optional(),
  riskWeighting: z.number().min(0).max(10).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ─── Contract CRUD ───────────────────────────────────────────

export const createContractSchema = z.object({
  vendorId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  contractType: z.enum(contractTypeValues).default("service_agreement"),
  contractNumber: z.string().max(100).optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  noticePeriodDays: z.number().int().min(0).default(90),
  autoRenewal: z.boolean().default(false),
  renewalPeriodMonths: z.number().int().min(1).optional(),
  totalValue: z.string().optional(),
  currency: z.string().length(3).default("EUR"),
  annualValue: z.string().optional(),
  paymentTerms: z.string().max(255).optional(),
  documentId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  approverId: z.string().uuid().optional(),
});

export const updateContractSchema = z.object({
  vendorId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  contractType: z.enum(contractTypeValues).optional(),
  contractNumber: z.string().max(100).nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  noticePeriodDays: z.number().int().min(0).optional(),
  autoRenewal: z.boolean().optional(),
  renewalPeriodMonths: z.number().int().min(1).nullable().optional(),
  totalValue: z.string().nullable().optional(),
  currency: z.string().length(3).optional(),
  annualValue: z.string().nullable().optional(),
  paymentTerms: z.string().max(255).nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  approverId: z.string().uuid().nullable().optional(),
});

export const contractStatusTransitionSchema = z.object({
  status: z.enum(contractStatusValues),
});

// ─── Contract Obligation ─────────────────────────────────────

export const createObligationSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  obligationType: z.enum(obligationTypeValues),
  dueDate: z.string().optional(),
  recurring: z.boolean().default(false),
  recurringIntervalMonths: z.number().int().min(1).optional(),
  responsibleId: z.string().uuid().optional(),
});

export const updateObligationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  obligationType: z.enum(obligationTypeValues).optional(),
  dueDate: z.string().nullable().optional(),
  recurring: z.boolean().optional(),
  recurringIntervalMonths: z.number().int().min(1).nullable().optional(),
  responsibleId: z.string().uuid().nullable().optional(),
});

export const obligationStatusTransitionSchema = z.object({
  status: z.enum(obligationStatusValues),
});

// ─── Contract Amendment ──────────────────────────────────────

export const createAmendmentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  effectiveDate: z.string().optional(),
  documentId: z.string().uuid().optional(),
});

// ─── Contract SLA ────────────────────────────────────────────

export const createSlaSchema = z.object({
  metricName: z.string().min(1).max(255),
  targetValue: z.string().min(1),
  unit: z.enum(["%", "hours", "minutes", "days", "count"]),
  measurementFrequency: z.enum(["monthly", "quarterly", "annually"]),
  penaltyClause: z.string().optional(),
});

export const updateSlaSchema = z.object({
  metricName: z.string().min(1).max(255).optional(),
  targetValue: z.string().min(1).optional(),
  unit: z.enum(["%", "hours", "minutes", "days", "count"]).optional(),
  measurementFrequency: z.enum(["monthly", "quarterly", "annually"]).optional(),
  penaltyClause: z.string().nullable().optional(),
});

// ─── SLA Measurement ─────────────────────────────────────────

export const createSlaMeasurementSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  actualValue: z.string().min(1),
  isBreach: z.boolean().default(false),
  notes: z.string().optional(),
});

// ─── LkSG Assessment ─────────────────────────────────────────

export const createLksgAssessmentSchema = z.object({
  assessmentDate: z.string().min(1),
  lksgTier: z.enum(["direct_supplier", "indirect_supplier", "own_operations"]),
  riskAreas: z.array(z.record(z.unknown())).optional(),
  mitigationPlans: z.array(z.record(z.unknown())).optional(),
  overallRiskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const updateLksgAssessmentSchema = z.object({
  lksgTier: z.enum(["direct_supplier", "indirect_supplier", "own_operations"]).optional(),
  riskAreas: z.array(z.record(z.unknown())).optional(),
  mitigationPlans: z.array(z.record(z.unknown())).optional(),
  status: z.enum(["draft", "in_progress", "completed", "reviewed"]).optional(),
  overallRiskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  nextReviewDate: z.string().optional(),
});

// ─── Vendor List Query ───────────────────────────────────────

export const vendorListQuerySchema = z.object({
  status: z.enum(vendorStatusValues).optional(),
  tier: z.enum(vendorTierValues).optional(),
  category: z.enum(vendorCategoryValues).optional(),
  search: z.string().max(200).optional(),
  isLksgRelevant: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("25"),
});

// ─── Contract List Query ─────────────────────────────────────

export const contractListQuerySchema = z.object({
  status: z.enum(contractStatusValues).optional(),
  contractType: z.enum(contractTypeValues).optional(),
  vendorId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  expiringWithinDays: z.string().transform(Number).pipe(z.number().int().min(1).max(365)).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("25"),
});
