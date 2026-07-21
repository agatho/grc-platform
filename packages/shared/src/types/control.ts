// Internal Control System (ICS) types (Sprint 4)
export type ControlType = "preventive" | "detective" | "corrective";
export type ControlFrequency =
  | "event_driven"
  | "continuous"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "ad_hoc";
export type AutomationLevel = "manual" | "semi_automated" | "fully_automated";
export type ControlStatus =
  "designed" | "implemented" | "effective" | "ineffective" | "retired";
export type ControlAssertion =
  | "completeness"
  | "accuracy"
  | "obligations_and_rights"
  | "fraud_prevention"
  | "existence"
  | "valuation"
  | "presentation"
  | "safeguarding_of_assets";
export type TestType = "design_effectiveness" | "operating_effectiveness";
export type TestResult =
  "effective" | "ineffective" | "partially_effective" | "not_tested";
export type TestStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";
// ISO 19011 § 3.4 — neue Werte plus Legacy-Synonyme (Migration 0293).
export type FindingSeverity =
  // ISO-konform
  | "positive"
  | "conforming"
  | "opportunity_for_improvement"
  | "minor_nonconformity"
  | "major_nonconformity"
  // Legacy
  | "observation"
  | "recommendation"
  | "improvement_requirement"
  | "insignificant_nonconformity"
  | "significant_nonconformity";
export type FindingStatus =
  | "identified"
  | "in_remediation"
  | "remediated"
  | "verified"
  | "accepted"
  | "closed";
export type FindingSource =
  "control_test" | "audit" | "incident" | "self_assessment" | "external";
export type EvidenceCategory =
  | "screenshot"
  | "document"
  | "log_export"
  | "email"
  | "certificate"
  | "report"
  | "photo"
  | "config_export"
  | "other";

export interface Control {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  controlType: ControlType;
  frequency: ControlFrequency;
  automationLevel: AutomationLevel;
  status: ControlStatus;
  assertions: string[];
  ownerId?: string;
  department?: string;
  objective?: string;
  testInstructions?: string;
  reviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface ControlTestCampaign {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  periodStart: string;
  periodEnd: string;
  responsibleId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface ControlTest {
  id: string;
  orgId: string;
  controlId: string;
  campaignId?: string;
  taskId?: string;
  testType: TestType;
  status: TestStatus;
  todResult?: TestResult;
  toeResult?: TestResult;
  testerId?: string;
  testDate?: string;
  sampleSize?: number;
  sampleDescription?: string;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface Evidence {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  category: EvidenceCategory;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
}

export interface Finding {
  id: string;
  orgId: string;
  workItemId?: string;
  controlId?: string;
  controlTestId?: string;
  riskId?: string;
  taskId?: string;
  auditId?: string;
  title: string;
  description?: string;
  severity: FindingSeverity;
  status: FindingStatus;
  source: FindingSource;
  ownerId?: string;
  remediationPlan?: string;
  remediationDueDate?: string;
  remediatedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

// Document Management System (DMS) types (Sprint 4)
export type DocumentCategory =
  | "policy"
  | "procedure"
  | "guideline"
  | "template"
  | "record"
  | "tom"
  | "dpa"
  | "bcp"
  | "soa"
  | "other";
export type DocumentStatus =
  "draft" | "in_review" | "approved" | "published" | "archived" | "expired";

export interface Document {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  content?: string;
  category: DocumentCategory;
  status: DocumentStatus;
  currentVersion: number;
  requiresAcknowledgment: boolean;
  tags: string[];
  ownerId?: string;
  reviewerId?: string;
  approverId?: string;
  publishedAt?: string;
  expiresAt?: string;
  reviewDate?: string;
  // Legacy inline file fields (mirror the newest document_file)
  fileName?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  fileSha256?: string | null;
  // D2/D3: document control + retention
  lastReminderSentAt?: string | null;
  retentionPolicyId?: string | null;
  retentionUntil?: string | null;
  legalHold?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  orgId: string;
  versionNumber: number;
  content?: string;
  changeSummary?: string;
  isCurrent: boolean;
  // D1: effective dating + major/minor label
  validFrom?: string | null;
  validUntil?: string | null;
  versionLabel?: string | null;
  versionMajor?: number | null;
  versionMinor?: number | null;
  fileName?: string | null;
  fileSha256?: string | null;
  createdBy?: string;
  createdAt: string;
}

export type DocumentApprovalStepType = "review" | "approval";
export type DocumentApprovalStepStatus = "pending" | "completed" | "rejected";

export interface DocumentApprovalStep {
  id: string;
  orgId: string;
  documentId: string;
  versionId?: string | null;
  stepOrder: number;
  stepType: DocumentApprovalStepType;
  assigneeUserId: string;
  status: DocumentApprovalStepStatus;
  decision?: "approved" | "rejected" | null;
  comment?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionPolicy {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  retentionYears: number;
  basis: "created" | "published" | "expired";
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFile {
  id: string;
  orgId: string;
  documentId: string;
  versionId?: string | null;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  sha256?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Acknowledgment {
  id: string;
  orgId: string;
  documentId: string;
  userId: string;
  versionAcknowledged: number;
  acknowledgedAt: string;
}

export interface DocumentEntityLink {
  id: string;
  orgId: string;
  documentId: string;
  entityType: string;
  entityId: string;
  linkDescription?: string;
  createdAt: string;
  createdBy?: string;
}
