// TPRM + Contract Management types (Sprint 9 + 9b)
export type VendorStatus = "prospect" | "onboarding" | "active" | "under_review" | "suspended" | "terminated";
export type VendorTier = "critical" | "important" | "standard" | "low_risk";
export type VendorCategory = "it_services" | "cloud_provider" | "consulting" | "facility" | "logistics" | "raw_materials" | "financial" | "hr_services" | "other";
export type DueDiligenceStatus = "pending" | "in_progress" | "completed" | "expired";
export type ContractStatus = "draft" | "negotiation" | "pending_approval" | "active" | "renewal" | "expired" | "terminated" | "archived";
export type ContractType = "master_agreement" | "service_agreement" | "nda" | "dpa" | "sla" | "license" | "maintenance" | "consulting" | "other";
export type ObligationStatus = "pending" | "in_progress" | "completed" | "overdue";
export type ObligationType = "deliverable" | "payment" | "reporting" | "compliance" | "audit_right";

export interface Vendor {
  id: string;
  orgId: string;
  workItemId?: string;
  name: string;
  legalName?: string;
  description?: string;
  category: VendorCategory;
  tier: VendorTier;
  status: VendorStatus;
  country?: string;
  address?: string;
  website?: string;
  taxId?: string;
  inherentRiskScore?: number;
  residualRiskScore?: number;
  lastAssessmentDate?: string;
  nextAssessmentDate?: string;
  isLksgRelevant: boolean;
  lksgTier?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface VendorContact {
  id: string;
  vendorId: string;
  orgId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRiskAssessment {
  id: string;
  vendorId: string;
  orgId: string;
  assessmentDate: string;
  inherentRiskScore: number;
  residualRiskScore: number;
  confidentialityScore?: number;
  integrityScore?: number;
  availabilityScore?: number;
  complianceScore?: number;
  financialScore?: number;
  reputationScore?: number;
  controlsApplied?: unknown;
  riskTrend?: string;
  assessedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface VendorDueDiligence {
  id: string;
  vendorId: string;
  orgId: string;
  questionnaireVersion?: string;
  status: DueDiligenceStatus;
  sentAt?: string;
  completedAt?: string;
  accessToken?: string;
  responses?: unknown;
  riskScore?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorDueDiligenceQuestion {
  id: string;
  orgId: string;
  category: string;
  questionText: string;
  answerType: string;
  riskWeighting?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  orgId: string;
  workItemId?: string;
  vendorId?: string;
  title: string;
  description?: string;
  contractType: ContractType;
  status: ContractStatus;
  contractNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  noticePeriodDays?: number;
  autoRenewal: boolean;
  renewalPeriodMonths?: number;
  totalValue?: string;
  currency?: string;
  annualValue?: string;
  paymentTerms?: string;
  documentId?: string;
  ownerId?: string;
  approverId?: string;
  signedDate?: string;
  signedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface ContractObligation {
  id: string;
  contractId: string;
  orgId: string;
  title: string;
  description?: string;
  obligationType: ObligationType;
  dueDate?: string;
  recurring: boolean;
  recurringIntervalMonths?: number;
  status: ObligationStatus;
  responsibleId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  orgId: string;
  title: string;
  description?: string;
  effectiveDate?: string;
  documentId?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ContractSla {
  id: string;
  contractId: string;
  orgId: string;
  metricName: string;
  targetValue: string;
  unit: string;
  measurementFrequency: string;
  penaltyClause?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSlaMeasurement {
  id: string;
  slaId: string;
  orgId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: string;
  isBreach: boolean;
  notes?: string;
  measuredBy?: string;
  createdAt: string;
}

export interface LksgAssessment {
  id: string;
  vendorId: string;
  orgId: string;
  assessmentDate: string;
  lksgTier: string;
  riskAreas?: unknown;
  mitigationPlans?: unknown;
  status: string;
  overallRiskLevel?: string;
  assessedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  nextReviewDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Sprint 9b: Supplier Portal

export type QuestionnaireTemplateStatus = "draft" | "published" | "archived";
export type QuestionType = "single_choice" | "multi_choice" | "text" | "yes_no" | "number" | "date" | "file_upload";
export type DdSessionStatus = "invited" | "in_progress" | "submitted" | "expired" | "revoked";

export interface QuestionOption {
  value: string;
  labelDe: string;
  labelEn: string;
  score: number;
}

export interface ConditionalRule {
  questionId: string;
  operator: "eq" | "neq" | "in" | "contains";
  value: string | string[];
}

export interface QuestionnaireTemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  version: number;
  status: QuestionnaireTemplateStatus;
  targetTier?: string;
  targetTopics?: string[];
  scoringModel?: Record<string, unknown>;
  isDefault: boolean;
  totalMaxScore: number;
  estimatedMinutes: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface QuestionnaireSection {
  id: string;
  templateId: string;
  titleDe: string;
  titleEn: string;
  descriptionDe?: string;
  descriptionEn?: string;
  sortOrder: number;
  weight: string;
  createdAt: string;
}

export interface QuestionnaireQuestion {
  id: string;
  sectionId: string;
  questionType: QuestionType;
  questionDe: string;
  questionEn: string;
  helpTextDe?: string;
  helpTextEn?: string;
  options?: QuestionOption[];
  isRequired: boolean;
  isEvidenceRequired: boolean;
  conditionalOn?: ConditionalRule;
  weight: string;
  maxScore: number;
  sortOrder: number;
  createdAt: string;
}

export interface DdSession {
  id: string;
  orgId: string;
  vendorId: string;
  dueDiligenceId?: string;
  templateId: string;
  templateVersion: number;
  accessToken: string;
  tokenExpiresAt: string;
  tokenUsedAt?: string;
  status: DdSessionStatus;
  language: string;
  progressPercent: number;
  totalScore?: number;
  maxPossibleScore?: number;
  submittedAt?: string;
  invitedAt: string;
  lastReminderAt?: string;
  supplierEmail: string;
  supplierName?: string;
  ipAddressLog?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface DdResponse {
  id: string;
  sessionId: string;
  questionId: string;
  answerText?: string;
  answerChoice?: string[];
  answerNumber?: string;
  answerDate?: string;
  answerBoolean?: boolean;
  score?: number;
  updatedAt: string;
}

export interface DdEvidence {
  id: string;
  sessionId: string;
  questionId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  virusScanStatus: string;
  uploadedAt: string;
}
