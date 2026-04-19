// Sprint 76: Certification und Audit Prep Wizard Types

export type CertFramework =
  // Core ISMS
  | "iso_27001"
  | "iso_27002"
  | "bsi_grundschutz"
  | "bsi_c5_2020"
  | "nis2"
  | "soc2_type2"
  | "isae3402_soc2"
  | "tisax"
  | "iso_22301"
  | "iso_9001"
  // ISO 27k extensions
  | "iso_27017_2015"
  | "iso_27018_2019"
  | "iso_27019_2017"
  | "iso_27701_2019"
  // Cloud / Industry
  | "csa_ccm_v4"
  | "iec_62443"
  | "swift_cscf_v2024"
  | "pci_dss_v4"
  // US Federal / DoD
  | "nist_800_53_r5"
  | "nist_800_171"
  | "cmmc_v2"
  // Privacy / AI / Sector
  | "hipaa_security"
  | "iso_42001_2023"
  | "eu_cra_2024"
  | "eu_dora"
  | "eu_ai_act";
export type CertAssessmentStatus = "draft" | "in_progress" | "completed" | "approved" | "expired";
export type CertMockAuditType = "stage_1" | "stage_2" | "surveillance" | "recertification";
export type CertMockAuditStatus = "draft" | "in_progress" | "completed" | "reviewed";
export type CertEvidenceStatus = "draft" | "generating" | "complete" | "submitted";

export interface CertReadinessAssessment {
  id: string;
  orgId: string;
  assessmentCode: string;
  title: string;
  framework: CertFramework;
  frameworkVersion?: string;
  scope?: string;
  targetCertDate?: string;
  totalControls: number;
  implementedControls: number;
  partialControls: number;
  notImplemented: number;
  notApplicable: number;
  readinessScore?: number;
  controlDetails: CertControlDetail[];
  gapAnalysis: CertGapItem[];
  timeline: CertTimelinePhase[];
  risks: CertRisk[];
  leadAssessorId?: string;
  assessedAt?: string;
  nextReviewDate?: string;
  status: CertAssessmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CertControlDetail {
  controlRef: string;
  title: string;
  status: string;
  gaps: string;
  evidence: string;
  priority: string;
}

export interface CertGapItem {
  area: string;
  gap: string;
  severity: string;
  recommendation: string;
  effort: string;
}

export interface CertTimelinePhase {
  phase: string;
  startDate: string;
  endDate: string;
  tasks: string[];
  status: string;
}

export interface CertRisk {
  risk: string;
  impact: string;
  mitigation: string;
}

export interface CertEvidencePackage {
  id: string;
  orgId: string;
  assessmentId?: string;
  packageCode: string;
  title: string;
  framework: CertFramework;
  controlRefs: string[];
  evidenceItems: CertEvidenceItem[];
  completeness?: number;
  missingEvidence: CertMissingEvidence[];
  generatedAt?: string;
  generatedBy?: string;
  exportFormat?: string;
  exportUrl?: string;
  status: CertEvidenceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CertEvidenceItem {
  documentId: string;
  title: string;
  type: string;
  controlRef: string;
  uploadedAt: string;
  status: string;
}

export interface CertMissingEvidence {
  controlRef: string;
  requiredType: string;
  description: string;
}

export interface CertMockAudit {
  id: string;
  orgId: string;
  assessmentId?: string;
  auditCode: string;
  title: string;
  framework: CertFramework;
  auditType: CertMockAuditType;
  scope?: string;
  questions: CertMockQuestion[];
  totalQuestions: number;
  answeredQuestions: number;
  responses: CertMockResponse[];
  overallScore?: number;
  findings: CertMockFinding[];
  strengths: CertMockStrength[];
  weaknesses: CertMockWeakness[];
  startedAt?: string;
  completedAt?: string;
  auditorId?: string;
  status: CertMockAuditStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CertMockQuestion {
  controlRef: string;
  question: string;
  expectedAnswer: string;
  difficulty: string;
  category: string;
}

export interface CertMockResponse {
  questionIndex: number;
  response: string;
  aiScore: number;
  aiFeedback: string;
  evidence: string;
}

export interface CertMockFinding {
  severity: string;
  controlRef: string;
  finding: string;
  recommendation: string;
}

export interface CertMockStrength {
  area: string;
  description: string;
}

export interface CertMockWeakness {
  area: string;
  description: string;
  remediation: string;
}

export interface CertWizardDashboard {
  totalAssessments: number;
  averageReadiness: number;
  assessmentsByFramework: Record<CertFramework, number>;
  readinessByFramework: Record<string, number>;
  upcomingCertDates: CertReadinessAssessment[];
  totalEvidencePackages: number;
  completedMockAudits: number;
  averageMockScore: number;
}
