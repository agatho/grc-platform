// Data Protection Management System (DPMS) types (Sprint 7)
export type RopaLegalBasis =
  | "consent"
  | "contract"
  | "legal_obligation"
  | "vital_interest"
  | "public_interest"
  | "legitimate_interest";
export type RopaStatus = "draft" | "active" | "under_review" | "archived";
export type DpiaStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "pending_dpo_review"
  | "approved"
  | "rejected";
export type DsrType =
  | "access"
  | "erasure"
  | "restriction"
  | "portability"
  | "objection";
export type DsrStatus =
  | "received"
  | "verified"
  | "processing"
  | "response_sent"
  | "closed"
  | "rejected";
export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus =
  | "detected"
  | "assessing"
  | "notifying_dpa"
  | "notifying_individuals"
  | "remediation"
  | "closed";
export type TiaLegalBasis = "adequacy" | "sccs" | "bcrs" | "derogation";
export type TiaRiskRating = "low" | "medium" | "high";

export interface RopaEntry {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  purpose: string;
  legalBasis: RopaLegalBasis;
  legalBasisDetail?: string;
  controllerOrgId?: string;
  processorName?: string;
  processingDescription?: string;
  retentionPeriod?: string;
  retentionJustification?: string;
  technicalMeasures?: string;
  organizationalMeasures?: string;
  internationalTransfer: boolean;
  transferCountry?: string;
  transferSafeguard?: string;
  status: RopaStatus;
  lastReviewed?: string;
  nextReviewDate?: string;
  responsibleId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface RopaDataCategory {
  id: string;
  orgId: string;
  ropaEntryId: string;
  category: string;
  createdAt: string;
}

export interface RopaDataSubject {
  id: string;
  orgId: string;
  ropaEntryId: string;
  subjectCategory: string;
  createdAt: string;
}

export interface RopaRecipient {
  id: string;
  orgId: string;
  ropaEntryId: string;
  recipientName: string;
  recipientType?: string;
  createdAt: string;
}

export interface Dpia {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  processingDescription?: string;
  legalBasis?: RopaLegalBasis;
  necessityAssessment?: string;
  dpoConsultationRequired: boolean;
  status: DpiaStatus;
  residualRiskSignOffId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DpiaRisk {
  id: string;
  orgId: string;
  dpiaId: string;
  riskDescription: string;
  severity: string;
  likelihood: string;
  impact: string;
  createdAt: string;
}

export interface DpiaMeasure {
  id: string;
  orgId: string;
  dpiaId: string;
  measureDescription: string;
  implementationTimeline?: string;
  createdAt: string;
}

export interface Dsr {
  id: string;
  orgId: string;
  workItemId?: string;
  requestType: DsrType;
  status: DsrStatus;
  subjectName?: string;
  subjectEmail?: string;
  receivedAt: string;
  deadline: string;
  verifiedAt?: string;
  respondedAt?: string;
  closedAt?: string;
  handlerId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface DsrActivity {
  id: string;
  orgId: string;
  dsrId: string;
  activityType: string;
  timestamp: string;
  details?: string;
  createdBy?: string;
}

export interface DataBreach {
  id: string;
  orgId: string;
  workItemId?: string;
  incidentId?: string;
  title: string;
  description?: string;
  severity: BreachSeverity;
  status: BreachStatus;
  detectedAt: string;
  dpaNotifiedAt?: string;
  individualsNotifiedAt?: string;
  isDpaNotificationRequired: boolean;
  isIndividualNotificationRequired: boolean;
  dataCategoriesAffected?: string[];
  estimatedRecordsAffected?: number;
  affectedCountries?: string[];
  containmentMeasures?: string;
  remediationMeasures?: string;
  lessonsLearned?: string;
  dpoId?: string;
  assigneeId?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DataBreachNotification {
  id: string;
  orgId: string;
  dataBreachId: string;
  recipientType: string;
  recipientEmail?: string;
  sentAt?: string;
  responseStatus?: string;
  createdAt: string;
}

export interface Tia {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  transferCountry: string;
  legalBasis: TiaLegalBasis;
  schremsIiAssessment?: string;
  riskRating: TiaRiskRating;
  supportingDocuments?: string;
  responsibleId?: string;
  assessmentDate?: string;
  nextReviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DpmsDashboard {
  ropaEntryCount: number;
  ropaByStatus: Record<RopaStatus, number>;
  activeDpiaCount: number;
  openDsrCount: number;
  dsrOverdueCount: number;
  activeBreachCount: number;
  breachesRequiringNotification: number;
  tiaCount: number;
  tiaHighRiskCount: number;
}
