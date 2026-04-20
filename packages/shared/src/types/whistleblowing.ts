// Whistleblowing (HinSchG) types (Sprint 12)
export type WbCategory =
  | "fraud"
  | "corruption"
  | "discrimination"
  | "privacy"
  | "environmental"
  | "health_safety"
  | "other";
export type WbCaseStatus =
  | "received"
  | "acknowledged"
  | "investigating"
  | "resolved"
  | "closed";
export type WbPriority = "low" | "medium" | "high" | "critical";
export type WbResolutionCategory =
  | "substantiated"
  | "unsubstantiated"
  | "inconclusive"
  | "referred";
export type WbDirection = "inbound" | "outbound";
export type WbAuthorType = "whistleblower" | "ombudsperson";

export interface WbReport {
  id: string;
  orgId: string;
  reportToken: string;
  tokenExpiresAt: string;
  category: WbCategory;
  description: string;
  contactEmail?: string;
  language: string;
  ipHash?: string;
  submittedAt: string;
  createdAt: string;
}

export interface WbCase {
  id: string;
  orgId: string;
  reportId: string;
  caseNumber: string;
  status: WbCaseStatus;
  priority: WbPriority;
  assignedTo?: string;
  acknowledgedAt?: string;
  acknowledgeDeadline: string;
  responseDeadline: string;
  resolution?: string;
  resolutionCategory?: WbResolutionCategory;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface WbCaseMessage {
  id: string;
  caseId: string;
  orgId: string;
  direction: WbDirection;
  content: string;
  authorType: WbAuthorType;
  authorId?: string;
  readAt?: string;
  createdAt: string;
}

export interface WbCaseEvidence {
  id: string;
  caseId?: string;
  reportId?: string;
  orgId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  sha256Hash: string;
  uploadedBy?: string;
  uploadedAt: string;
  isImmutable: boolean;
}

export interface WbAnonymousMailbox {
  id: string;
  reportId: string;
  token: string;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
}

export interface WbCaseListItem {
  id: string;
  caseNumber: string;
  category: WbCategory;
  status: WbCaseStatus;
  priority: WbPriority;
  submittedAt: string;
  acknowledgeDeadline: string;
  responseDeadline: string;
  acknowledgedAt?: string;
  assignedToName?: string;
}

export interface WbCaseDetail {
  case: WbCase & { assignedToName?: string };
  report: WbReport;
  messages: WbCaseMessage[];
  evidence: WbCaseEvidence[];
}

export interface WbMailboxView {
  status: WbCaseStatus;
  caseNumber: string;
  acknowledgeDeadline: string;
  responseDeadline: string;
  acknowledgedAt?: string;
  messages: Array<{
    direction: WbDirection;
    content: string;
    authorType: WbAuthorType;
    createdAt: string;
  }>;
  evidence: Array<{
    fileName: string;
    fileSize: number;
    uploadedAt: string;
  }>;
}

export interface WbStatistics {
  totalYtd: number;
  totalPreviousYear: number;
  avgResolutionDays: number;
  sla7dCompliance: number;
  sla3mCompliance: number;
  byCategory: Record<WbCategory, number>;
  byMonth: Array<{ month: string; count: number }>;
  byResolution: Record<string, number>;
  byStatus: Record<WbCaseStatus, number>;
}
