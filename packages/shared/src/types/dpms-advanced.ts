// Sprint 42: DPMS Advanced Types

export interface RetentionSchedule {
  id: string;
  orgId: string;
  name: string;
  dataCategory: string;
  legalBasisReference?: string;
  retentionPeriodMonths: number;
  retentionStartEvent: string;
  responsibleDepartment?: string;
  deletionMethod: string;
  affectedSystems: Array<{
    systemName: string;
    dataLocation?: string;
    deletionCapability: "auto" | "manual" | "not_possible";
  }>;
  isActive: boolean;
}

export interface RetentionException {
  id: string;
  scheduleId: string;
  reason: string;
  legalBasis?: string;
  description?: string;
  expiresAt: string;
  status: "active" | "expired" | "released";
}

export interface DeletionRequest {
  id: string;
  scheduleId: string;
  title: string;
  dataCategory: string;
  recordCountEstimate?: number;
  status: "identified" | "pending_approval" | "approved" | "deletion_in_progress" | "verified" | "closed" | "rejected";
  approvedBy?: string;
  verificationMethod?: string;
  evidenceDescription?: string;
}

export interface TransferImpactAssessment {
  id: string;
  orgId: string;
  title: string;
  recipientCountry: string;
  legalTransferBasis: string;
  countryRiskLevel?: string;
  overallCountryRiskScore?: number;
  assessmentResult?: "transfer_permitted" | "transfer_permitted_with_measures" | "transfer_suspended" | "further_assessment_needed";
  version: number;
  status: string;
}

export interface CountryRiskProfile {
  id: string;
  countryCode: string;
  countryName: string;
  euAdequacyDecision: boolean;
  adequacyDecisionDate?: string;
  surveillanceLawsSummary?: string;
  governmentAccessSummary?: string;
  ruleOfLawIndex?: number;
  dpaIndependent?: boolean;
  judicialRedressAvailable?: boolean;
  overallRiskLevel: "low" | "medium" | "high" | "very_high";
}

export interface ProcessorAgreement {
  id: string;
  orgId: string;
  vendorId?: string;
  processorName: string;
  agreementStatus: "pending" | "negotiation" | "active" | "terminated" | "expired";
  complianceChecklist: Array<{
    requirement: string;
    status: "compliant" | "partial" | "missing";
    notes?: string;
  }>;
  overallComplianceStatus?: "compliant" | "partially_compliant" | "non_compliant";
}

export interface SubProcessorNotification {
  id: string;
  agreementId: string;
  notificationType: "new_sub_processor" | "changed_sub_processor" | "removed_sub_processor";
  subProcessorName: string;
  subProcessorCountry?: string;
  responseDeadline: string;
  response: "pending" | "approved" | "objected";
}

export interface PbdAssessment {
  id: string;
  orgId: string;
  projectName: string;
  projectType: string;
  assessmentData: Array<{
    principle: string;
    questions: Array<{
      question: string;
      answer: "yes" | "no" | "partial";
      evidence?: string;
      notes?: string;
    }>;
    score: number;
  }>;
  overallScore?: number;
  dpiaRequired: boolean;
  status: "draft" | "in_progress" | "completed" | "approved" | "rejected";
}

export interface ConsentType {
  id: string;
  orgId: string;
  name: string;
  purpose: string;
  collectionPoint: string;
  freelyGivenStatus?: string;
  specificStatus?: string;
  informedStatus?: string;
  unambiguousStatus?: string;
  totalGiven: number;
  totalWithdrawn: number;
  withdrawalRate: number;
  activeConsents: number;
}

export interface ConsentRecord {
  id: string;
  consentTypeId: string;
  dataSubjectIdentifier: string;
  consentGivenAt: string;
  consentMechanism: string;
  withdrawnAt?: string;
  withdrawalMechanism?: string;
  sourceSystem?: string;
}

export interface ConsentDashboard {
  types: Array<{
    id: string;
    name: string;
    purpose: string;
    totalGiven: number;
    totalWithdrawn: number;
    withdrawalRate: number;
    activeConsents: number;
    validityStatus: string;
  }>;
  totalActiveConsents: number;
  totalWithdrawals: number;
  avgWithdrawalRate: number;
}

export interface RetentionDashboard {
  totalSchedules: number;
  activeSchedules: number;
  overdue: number;
  pendingDeletions: number;
  activeExceptions: number;
  deletionPipeline: {
    identified: number;
    pendingApproval: number;
    inProgress: number;
    verified: number;
  };
}
