import { z } from "zod";

// Sprint 7: Data Protection Management System (DPMS) schemas

const ropaLegalBasisValues = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interest",
  "public_interest",
  "legitimate_interest",
] as const;
const ropaStatusValues = [
  "draft",
  "active",
  "under_review",
  "archived",
] as const;
const dpiaStatusValues = [
  "draft",
  "in_progress",
  "completed",
  "pending_dpo_review",
  "approved",
  "rejected",
] as const;
const dsrTypeValues = [
  "access",
  "erasure",
  "restriction",
  "portability",
  "objection",
] as const;
const dsrStatusValues = [
  "received",
  "verified",
  "processing",
  "response_sent",
  "closed",
  "rejected",
] as const;
const breachSeverityValues = ["low", "medium", "high", "critical"] as const;
const breachStatusValues = [
  "detected",
  "assessing",
  "notifying_dpa",
  "notifying_individuals",
  "remediation",
  "closed",
] as const;
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

export const thirdCountryTransferSchema = z.object({
  country: z.string().min(1),
  legalBasis: z.string().min(1),
  safeguards: z.string().min(1),
});

export const createDpiaSchema = z.object({
  title: z.string().min(1).max(500),
  processingDescription: z.string().optional(),
  legalBasis: z.enum(ropaLegalBasisValues).optional(),
  necessityAssessment: z.string().optional(),
  dpoConsultationRequired: z.boolean().default(false),
  // Art. 35 enhancement fields
  systematicDescription: z.string().optional(),
  dataCategories: z.array(z.string()).max(50).optional(),
  dataSubjectCategories: z.array(z.string()).max(50).optional(),
  recipients: z.array(z.string()).max(50).optional(),
  thirdCountryTransfers: z.array(thirdCountryTransferSchema).max(20).optional(),
  retentionPeriod: z.string().max(255).optional(),
  consultationResult: z.string().optional(),
  consultationDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
  dpoOpinion: z.string().optional(),
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
  riskId: z.string().uuid().nullable().optional(),
  implementationTimeline: z.string().max(255).optional(),
  costOnetime: z.number().min(0).optional(),
  costAnnual: z.number().min(0).optional(),
  effortHours: z.number().min(0).optional(),
  costCurrency: z.string().max(3).optional(),
  costNote: z.string().optional(),
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
  estimatedRecordsAffected: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
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
  recipientType: z.enum([
    "dpa",
    "individual",
    "processor",
    "controller",
    "other",
  ]),
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
