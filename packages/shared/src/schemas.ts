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
