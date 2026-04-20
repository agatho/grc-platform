import { z } from "zod";

// Sprint 9: TPRM + Contract Management schemas

const vendorStatusValues = [
  "prospect",
  "onboarding",
  "active",
  "under_review",
  "suspended",
  "terminated",
] as const;
const vendorTierValues = [
  "critical",
  "important",
  "standard",
  "low_risk",
] as const;
const vendorCategoryValues = [
  "it_services",
  "cloud_provider",
  "consulting",
  "facility",
  "logistics",
  "raw_materials",
  "financial",
  "hr_services",
  "other",
] as const;
const ddStatusValues = [
  "pending",
  "in_progress",
  "completed",
  "expired",
] as const;
const contractStatusValues = [
  "draft",
  "negotiation",
  "pending_approval",
  "active",
  "renewal",
  "expired",
  "terminated",
  "archived",
] as const;
const contractTypeValues = [
  "master_agreement",
  "service_agreement",
  "nda",
  "dpa",
  "sla",
  "license",
  "maintenance",
  "consulting",
  "other",
] as const;
const obligationStatusValues = [
  "pending",
  "in_progress",
  "completed",
  "overdue",
] as const;
const obligationTypeValues = [
  "deliverable",
  "payment",
  "reporting",
  "compliance",
  "audit_right",
] as const;

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
  answerType: z
    .enum(["text", "yes_no", "scale", "multi_choice", "file_upload"])
    .default("text"),
  riskWeighting: z.number().min(0).max(10).optional(),
  sortOrder: z.number().int().default(0),
});

export const updateDdQuestionSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  questionText: z.string().min(1).optional(),
  answerType: z
    .enum(["text", "yes_no", "scale", "multi_choice", "file_upload"])
    .optional(),
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
  slaDefinitionId: z.string().uuid(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  actualValue: z.number(),
  isBreach: z.boolean().default(false),
  evidence: z.string().max(5000).optional(),
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
  lksgTier: z
    .enum(["direct_supplier", "indirect_supplier", "own_operations"])
    .optional(),
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
  isLksgRelevant: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default("25"),
});

// ─── Contract List Query ─────────────────────────────────────

export const contractListQuerySchema = z.object({
  status: z.enum(contractStatusValues).optional(),
  contractType: z.enum(contractTypeValues).optional(),
  vendorId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  expiringWithinDays: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(365))
    .optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default("25"),
});

// Sprint 9b: Supplier Portal & Questionnaire Designer

// ─── Question Option / Conditional ───────────────────────────

export const questionOptionSchema = z.object({
  value: z.string().min(1),
  labelDe: z.string().min(1),
  labelEn: z.string().min(1),
  score: z.number().int().min(0).default(0),
});

export const conditionalSchema = z.object({
  questionId: z.string().uuid(),
  operator: z.enum(["eq", "neq", "in", "contains"]),
  value: z.union([z.string(), z.array(z.string())]),
});

// ─── Questionnaire Template ──────────────────────────────────

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  targetTier: z
    .enum(["critical", "important", "standard", "low_risk"])
    .optional(),
  targetTopics: z.array(z.string()).optional(),
  estimatedMinutes: z.number().int().min(5).max(480).default(30),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const publishTemplateSchema = z.object({
  versionMessage: z.string().max(500).optional(),
});

// ─── Questionnaire Section ───────────────────────────────────

export const createSectionSchema = z.object({
  titleDe: z.string().min(1).max(500),
  titleEn: z.string().min(1).max(500),
  descriptionDe: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0),
  weight: z.number().min(0).max(100).default(1),
});

export const updateSectionSchema = createSectionSchema.partial();

// ─── Questionnaire Question ──────────────────────────────────

export const createQuestionSchema = z
  .object({
    questionType: z.enum([
      "single_choice",
      "multi_choice",
      "text",
      "yes_no",
      "number",
      "date",
      "file_upload",
    ]),
    questionDe: z.string().min(3).max(2000),
    questionEn: z.string().min(3).max(2000),
    helpTextDe: z.string().max(1000).optional(),
    helpTextEn: z.string().max(1000).optional(),
    options: z.array(questionOptionSchema).optional(),
    isRequired: z.boolean().default(true),
    isEvidenceRequired: z.boolean().default(false),
    conditionalOn: conditionalSchema.optional(),
    weight: z.number().min(0).max(100).default(1),
    maxScore: z.number().int().min(0).default(0),
    sortOrder: z.number().int().min(0),
  })
  .refine(
    (data) => {
      if (["single_choice", "multi_choice"].includes(data.questionType)) {
        return data.options && data.options.length >= 2;
      }
      return true;
    },
    { message: "Choice questions require at least 2 options" },
  );

export const updateQuestionSchema = z.object({
  questionType: z
    .enum([
      "single_choice",
      "multi_choice",
      "text",
      "yes_no",
      "number",
      "date",
      "file_upload",
    ])
    .optional(),
  questionDe: z.string().min(3).max(2000).optional(),
  questionEn: z.string().min(3).max(2000).optional(),
  helpTextDe: z.string().max(1000).optional(),
  helpTextEn: z.string().max(1000).optional(),
  options: z.array(questionOptionSchema).optional(),
  isRequired: z.boolean().optional(),
  isEvidenceRequired: z.boolean().optional(),
  conditionalOn: conditionalSchema.optional(),
  weight: z.number().min(0).max(100).optional(),
  maxScore: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── DD Session / Invitation ─────────────────────────────────

export const inviteVendorSchema = z.object({
  templateId: z.string().uuid(),
  supplierEmail: z.string().email(),
  supplierName: z.string().min(1).max(500),
  language: z.enum(["de", "en"]).default("de"),
  deadline: z.string().datetime(),
});

export const extendSessionSchema = z.object({
  newDeadline: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

// ─── Portal (Supplier-facing) ────────────────────────────────

export const portalResponseSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().max(5000).optional(),
  answerChoice: z.array(z.string()).optional(),
  answerNumber: z.number().optional(),
  answerDate: z.string().date().optional(),
  answerBoolean: z.boolean().optional(),
});

export const portalSaveResponsesSchema = z.object({
  responses: z.array(portalResponseSchema).min(1).max(200),
});

export const portalSubmitSchema = z.object({
  confirmComplete: z.literal(true, {
    errorMap: () => ({ message: "Must confirm completion" }),
  }),
});

export const portalEvidenceUploadSchema = z.object({
  questionId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(500),
  fileType: z.enum([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
  ]),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
});
