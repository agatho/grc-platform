// Sprint 73: EU AI Act Governance Module Types

export type AiRiskClassification = "unacceptable" | "high" | "limited" | "minimal";
export type AiTechnique = "machine_learning" | "deep_learning" | "nlp" | "computer_vision" | "expert_system" | "generative_ai";
export type AiAnnexCategory = "annex_i" | "annex_ii" | "annex_iii" | "annex_iv" | "none";
export type AiProviderDeployer = "provider" | "deployer" | "both";
export type AiSystemStatus = "draft" | "registered" | "under_review" | "compliant" | "non_compliant" | "decommissioned";
export type AiAssessmentType = "self_assessment" | "third_party" | "notified_body";
export type AiAssessmentResult = "pass" | "fail" | "conditional" | "pending";
export type AiAssessmentStatus = "draft" | "in_progress" | "completed" | "expired";
export type AiOversightLogType = "decision_override" | "intervention" | "monitoring_check" | "bias_review" | "performance_review";
export type AiTransparencyEntryType = "eu_database_registration" | "public_disclosure" | "user_notification" | "marking_labeling";
export type AiTransparencyStatus = "draft" | "published" | "updated" | "withdrawn";
export type AiFriaImpact = "high" | "medium" | "low" | "negligible";
export type AiFriaStatus = "draft" | "in_progress" | "completed" | "approved";
export type AiFramework = "iso_42001" | "nist_ai_rmf" | "eu_ai_act";
export type AiImplementationStatus = "not_started" | "in_progress" | "implemented" | "not_applicable";

export interface AiSystem {
  id: string;
  orgId: string;
  systemCode: string;
  name: string;
  description?: string;
  purpose?: string;
  aiTechnique?: AiTechnique;
  riskClassification: AiRiskClassification;
  riskJustification?: string;
  annexCategory?: AiAnnexCategory;
  providerOrDeployer: AiProviderDeployer;
  providerName?: string;
  providerJurisdiction?: string;
  deploymentDate?: string;
  trainingData: Record<string, unknown>;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  affectedPersons: AiAffectedPerson[];
  technicalDocumentation: Record<string, unknown>;
  humanOversightRequired: boolean;
  transparencyObligations: string[];
  ownerId?: string;
  status: AiSystemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiAffectedPerson {
  category: string;
  count: number;
  vulnerableGroup: boolean;
}

export interface AiConformityAssessment {
  id: string;
  orgId: string;
  aiSystemId: string;
  assessmentCode: string;
  assessmentType: AiAssessmentType;
  assessorName?: string;
  requirements: AiRequirement[];
  overallResult?: AiAssessmentResult;
  findings: AiAssessmentFinding[];
  certificateRef?: string;
  validFrom?: string;
  validUntil?: string;
  assessedAt?: string;
  assessedBy?: string;
  status: AiAssessmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiRequirement {
  requirementId: string;
  description: string;
  status: string;
  evidence: string;
  notes: string;
}

export interface AiAssessmentFinding {
  severity: string;
  description: string;
  recommendation: string;
}

export interface AiHumanOversightLog {
  id: string;
  orgId: string;
  aiSystemId: string;
  logType: AiOversightLogType;
  description: string;
  aiDecision?: string;
  humanDecision?: string;
  overrideReason?: string;
  affectedCount?: number;
  riskLevel?: string;
  reviewerId: string;
  reviewedAt: string;
  createdAt: string;
}

export interface AiTransparencyEntry {
  id: string;
  orgId: string;
  aiSystemId: string;
  entryType: AiTransparencyEntryType;
  title: string;
  content: string;
  publicUrl?: string;
  registrationRef?: string;
  publishedAt?: string;
  publishedBy?: string;
  status: AiTransparencyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiFria {
  id: string;
  orgId: string;
  aiSystemId: string;
  assessmentCode: string;
  rightsAssessed: AiFriaRight[];
  discriminationRisk: Record<string, unknown>;
  dataProtectionImpact: Record<string, unknown>;
  accessToJustice: Record<string, unknown>;
  overallImpact: AiFriaImpact;
  mitigationPlan?: string;
  consultationResults: AiFriaConsultation[];
  assessedBy?: string;
  assessedAt?: string;
  nextReviewDate?: string;
  status: AiFriaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiFriaRight {
  right: string;
  impact: string;
  mitigation: string;
  residualRisk: string;
}

export interface AiFriaConsultation {
  stakeholder: string;
  feedback: string;
  incorporated: boolean;
}

export interface AiFrameworkMappingEntry {
  id: string;
  orgId: string;
  framework: AiFramework;
  controlRef: string;
  controlTitle: string;
  aiActArticle?: string;
  implementationStatus: AiImplementationStatus;
  evidence: Record<string, unknown>[];
  notes?: string;
  assessedBy?: string;
  assessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiActDashboard {
  totalSystems: number;
  highRiskSystems: number;
  unacceptableSystems: number;
  pendingAssessments: number;
  oversightLogs30d: number;
  transparencyEntries: number;
  friasPending: number;
  documentationDue: number;
  frameworkCompliance: Record<string, number>;
  systemsByRisk: Record<AiRiskClassification, number>;
  recentOversightLogs: AiHumanOversightLog[];
}
