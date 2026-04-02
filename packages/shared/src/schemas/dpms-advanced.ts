import { z } from "zod";
import { createHash } from "crypto";

// Sprint 42: DPMS Advanced — Retention, TIA, Processor Agreements, PbD, Consent

// ─── Retention Schedules ────────────────────────────────────
export const createRetentionScheduleSchema = z.object({
  name: z.string().min(1).max(500),
  dataCategory: z.enum(["employee_data", "customer_data", "financial", "marketing", "health", "applicant", "vendor_contact", "visitor", "research"]),
  legalBasisReference: z.string().max(500).optional(),
  retentionPeriodMonths: z.number().int().min(1).max(1200),
  retentionStartEvent: z.enum(["creation", "last_activity", "contract_end", "employment_end", "consent_withdrawal", "purpose_fulfilled"]),
  responsibleDepartment: z.string().max(200).optional(),
  deletionMethod: z.enum(["automated", "manual", "anonymization"]),
  affectedSystems: z.array(z.object({
    systemName: z.string().min(1).max(300),
    dataLocation: z.string().max(500).optional(),
    deletionCapability: z.enum(["auto", "manual", "not_possible"]),
  })).optional(),
});

export const updateRetentionScheduleSchema = createRetentionScheduleSchema.partial();

// ─── Retention Exceptions ───────────────────────────────────
export const createRetentionExceptionSchema = z.object({
  scheduleId: z.string().uuid(),
  reason: z.enum(["litigation_hold", "regulatory_investigation", "ongoing_contract", "audit_requirement", "other"]),
  legalBasis: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  expiresAt: z.string().date(),
  responsibleId: z.string().uuid().optional(),
});

// ─── Deletion Requests ──────────────────────────────────────
export const createDeletionRequestSchema = z.object({
  scheduleId: z.string().uuid(),
  title: z.string().min(1).max(500),
  dataCategory: z.string().max(50),
  recordCountEstimate: z.number().int().min(0).optional(),
  affectedSystemIds: z.array(z.string()).optional(),
});

export const approveDeletionSchema = z.object({
  justification: z.string().max(2000).optional(),
});

export const verifyDeletionSchema = z.object({
  verificationMethod: z.enum(["spot_check", "system_confirmation", "automated_verification"]),
  evidenceDescription: z.string().min(1).max(5000),
  evidenceDocumentId: z.string().uuid().optional(),
});

// ─── Deletion State Machine ─────────────────────────────────
export const DELETION_TRANSITIONS: Record<string, string[]> = {
  identified: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  approved: ["deletion_in_progress"],
  deletion_in_progress: ["verified"],
  verified: ["closed"],
  rejected: [],
  closed: [],
};

export function isValidDeletionTransition(
  currentStatus: string,
  newStatus: string,
): boolean {
  return DELETION_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ─── Transfer Impact Assessment ─────────────────────────────
export const createTiaAdvancedSchema = z.object({
  dataFlowId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  transferDescription: z.string().max(5000).optional(),
  dataCategories: z.array(z.string().max(100)).min(1),
  legalTransferBasis: z.enum(["adequacy", "scc", "bcr", "art49_consent", "art49_contract", "art49_public_interest"]),
  recipientCountry: z.string().length(2),
});

export const updateTiaAdvancedSchema = createTiaAdvancedSchema.partial().extend({
  surveillanceLawAssessment: z.string().max(5000).optional(),
  governmentAccessRisk: z.string().max(5000).optional(),
  ruleOfLawAssessment: z.string().max(5000).optional(),
  dpaIndependenceAssessment: z.string().max(5000).optional(),
  judicialRedressAssessment: z.string().max(5000).optional(),
  overallCountryRiskScore: z.number().int().min(0).max(100).optional(),
  supplementaryMeasuresRequired: z.boolean().optional(),
  technicalMeasures: z.array(z.object({
    measure: z.string(),
    status: z.enum(["planned", "implemented", "not_applicable"]),
  })).optional(),
  contractualMeasures: z.array(z.object({
    measure: z.string(),
    status: z.enum(["planned", "implemented", "not_applicable"]),
  })).optional(),
  organizationalMeasures: z.array(z.object({
    measure: z.string(),
    status: z.enum(["planned", "implemented", "not_applicable"]),
  })).optional(),
  assessmentResult: z.enum(["transfer_permitted", "transfer_permitted_with_measures", "transfer_suspended", "further_assessment_needed"]).optional(),
});

// ─── Processor Agreements ───────────────────────────────────
export const createProcessorAgreementSchema = z.object({
  vendorId: z.string().uuid().optional(),
  processorName: z.string().min(1).max(500),
  processorDpoContact: z.string().max(500).optional(),
  processingActivities: z.array(z.object({
    ropaEntryId: z.string().uuid().optional(),
    description: z.string().max(2000),
  })).optional(),
  effectiveDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  agreementDocumentId: z.string().uuid().optional(),
});

export const updateDpmsChecklistSchema = z.object({
  checklist: z.array(z.object({
    requirement: z.string(),
    status: z.enum(["compliant", "partial", "missing"]),
    notes: z.string().max(2000).optional(),
    evidenceId: z.string().uuid().optional(),
  })).length(16),
});

export const createDpmsSubProcessorNotificationSchema = z.object({
  notificationType: z.enum(["new_sub_processor", "changed_sub_processor", "removed_sub_processor"]),
  subProcessorName: z.string().min(1).max(500),
  subProcessorCountry: z.string().max(5).optional(),
  processingScope: z.string().max(5000).optional(),
  responseDeadline: z.string().date(),
});

export const respondSubProcessorSchema = z.object({
  response: z.enum(["approved", "objected"]),
  objectionReason: z.string().max(5000).optional(),
});

// ─── Privacy by Design ──────────────────────────────────────
export const createPbdAssessmentSchema = z.object({
  projectName: z.string().min(1).max(500),
  projectDescription: z.string().max(5000).optional(),
  projectType: z.enum(["software_development", "business_process", "product_launch", "vendor_onboarding", "data_initiative", "other"]),
});

export const submitPbdAssessmentSchema = z.object({
  assessmentData: z.array(z.object({
    principle: z.string().min(1),
    questions: z.array(z.object({
      question: z.string().min(1),
      answer: z.enum(["yes", "no", "partial"]),
      evidence: z.string().max(2000).optional(),
      notes: z.string().max(2000).optional(),
    })).min(1),
  })).min(1),
  dpiaCriteriaMet: z.array(z.object({
    criterion: z.string().min(1),
    met: z.boolean(),
  })).optional(),
});

// ─── Consent Management ─────────────────────────────────────
export const createConsentTypeSchema = z.object({
  name: z.string().min(1).max(500),
  purpose: z.enum(["marketing", "analytics", "profiling", "third_party_sharing", "research", "other"]),
  description: z.string().max(5000).optional(),
  collectionPoint: z.enum(["website", "mobile_app", "paper_form", "verbal", "email", "third_party"]),
  legalRequirements: z.object({
    granular: z.boolean().default(true),
    withdrawable: z.boolean().default(true),
    ageVerification: z.boolean().default(false),
    doubleOptIn: z.boolean().default(false),
  }).optional(),
  linkedRopaEntryIds: z.array(z.string().uuid()).optional(),
});

export const recordConsentSchema = z.object({
  consentTypeId: z.string().uuid(),
  dataSubjectIdentifier: z.string().min(1).max(256),
  consentMechanism: z.enum(["checkbox", "double_opt_in", "verbal_recorded", "written"]),
  consentTextVersion: z.string().max(50).optional(),
  sourceSystem: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const assessValiditySchema = z.object({
  freelyGivenStatus: z.enum(["valid", "questionable", "invalid"]),
  specificStatus: z.enum(["valid", "questionable", "invalid"]),
  informedStatus: z.enum(["valid", "questionable", "invalid"]),
  unambiguousStatus: z.enum(["valid", "questionable", "invalid"]),
  validityNotes: z.string().max(5000).optional(),
});

// ─── DPIA Trigger Assessment ────────────────────────────────
export const DPIA_TRIGGER_CRITERIA = [
  { id: "systematic_monitoring", description: "Systematic and extensive monitoring of a publicly accessible area" },
  { id: "sensitive_data", description: "Processing of special categories of data or criminal offence data on a large scale" },
  { id: "large_scale", description: "Processing of personal data on a large scale" },
  { id: "vulnerable_subjects", description: "Processing of data concerning vulnerable data subjects (children, employees, patients)" },
  { id: "innovative_technology", description: "Use of innovative technological or organizational solutions" },
  { id: "automated_decision", description: "Automated decision-making with legal or similarly significant effects" },
  { id: "cross_referencing", description: "Matching or combining datasets from different sources" },
  { id: "profiling", description: "Evaluation or scoring of data subjects (profiling)" },
  { id: "preventing_rights", description: "Processing that prevents data subjects from exercising a right or using a service/contract" },
];

export function assessDpiaTrigger(criteriaMet: Array<{ criterion: string; met: boolean }>): {
  dpiaRequired: boolean;
  criteriaMetCount: number;
  triggeredCriteria: string[];
} {
  const triggered = criteriaMet.filter((c) => c.met);
  return {
    dpiaRequired: triggered.length >= 2,
    criteriaMetCount: triggered.length,
    triggeredCriteria: triggered.map((c) => c.criterion),
  };
}

// ─── Art. 28(3) Checklist ───────────────────────────────────
export const ART_28_CHECKLIST_ITEMS = [
  { requirement: "Subject matter and duration of processing defined", article: "Art. 28(3)", category: "scope" },
  { requirement: "Nature and purpose of processing specified", article: "Art. 28(3)", category: "scope" },
  { requirement: "Types of personal data specified", article: "Art. 28(3)", category: "scope" },
  { requirement: "Categories of data subjects specified", article: "Art. 28(3)", category: "scope" },
  { requirement: "Obligations and rights of the controller defined", article: "Art. 28(3)", category: "obligations" },
  { requirement: "Processing only on documented instructions", article: "Art. 28(3a)", category: "instructions" },
  { requirement: "Confidentiality obligation for processing staff", article: "Art. 28(3b)", category: "confidentiality" },
  { requirement: "Appropriate technical and organizational measures", article: "Art. 28(3c)/Art. 32", category: "security" },
  { requirement: "Sub-processor engagement conditions defined", article: "Art. 28(3d)", category: "sub_processors" },
  { requirement: "Prior written authorization for sub-processors", article: "Art. 28(2)", category: "sub_processors" },
  { requirement: "Assistance with data subject rights", article: "Art. 28(3e)", category: "data_subjects" },
  { requirement: "Assistance with security obligations (Art. 32-36)", article: "Art. 28(3f)", category: "security" },
  { requirement: "Deletion or return of data after end of services", article: "Art. 28(3g)", category: "termination" },
  { requirement: "Audit and inspection rights granted", article: "Art. 28(3h)", category: "audit" },
  { requirement: "Information obligation regarding instruction conflicts", article: "Art. 28(3) last para", category: "instructions" },
  { requirement: "International transfer safeguards (if applicable)", article: "Art. 28(3)/Art. 44-49", category: "transfers" },
];

// ─── Consent Pseudonymization ───────────────────────────────
export function hashDataSubjectIdentifier(identifier: string, orgSalt: string): string {
  return createHash("sha256").update(`${orgSalt}:${identifier}`).digest("hex");
}

// ─── PbD Scoring ────────────────────────────────────────────
export function computePbdScore(
  assessmentData: Array<{
    principle: string;
    questions: Array<{ answer: "yes" | "no" | "partial" }>;
  }>,
): { principleScores: Array<{ principle: string; score: number }>; overallScore: number } {
  const principleScores = assessmentData.map((p) => {
    const total = p.questions.length;
    if (total === 0) return { principle: p.principle, score: 0 };
    const sum = p.questions.reduce((acc, q) => {
      if (q.answer === "yes") return acc + 100;
      if (q.answer === "partial") return acc + 50;
      return acc;
    }, 0);
    return { principle: p.principle, score: Math.round(sum / total) };
  });
  const overallScore =
    principleScores.length > 0
      ? Math.round(principleScores.reduce((a, b) => a + b.score, 0) / principleScores.length)
      : 0;
  return { principleScores, overallScore };
}
