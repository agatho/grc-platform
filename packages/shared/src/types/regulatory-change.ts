// Sprint 69: AI Regulatory Change Agent Types

export type RegulatorySourceType = "official_gazette" | "regulator" | "industry_body" | "eu_lex" | "custom_feed";
export type RegulatoryChangeType = "new_regulation" | "amendment" | "repeal" | "guidance" | "enforcement";
export type RegulatoryClassification = "critical" | "major" | "minor" | "informational";
export type RegulatoryChangeStatus = "new" | "under_review" | "assessed" | "acknowledged" | "not_applicable";
export type ImpactLevel = "critical" | "high" | "medium" | "low" | "none";
export type ImpactAssessmentStatus = "draft" | "in_review" | "approved" | "rejected";
export type RegulatoryCalendarEventType = "compliance_deadline" | "enforcement_date" | "consultation_end" | "reporting_deadline";
export type CalendarPriority = "critical" | "high" | "medium" | "low";
export type DigestType = "daily" | "weekly" | "monthly";

export interface RegulatorySource {
  id: string;
  orgId?: string;
  name: string;
  sourceType: RegulatorySourceType;
  url?: string;
  jurisdiction: string;
  frameworks?: string[];
  fetchFrequencyHours: number;
  parserConfig: Record<string, unknown>;
  isActive: boolean;
  lastFetchedAt?: string;
  lastFetchError?: string;
  totalChangesDetected: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryChange {
  id: string;
  orgId: string;
  sourceId?: string;
  externalId?: string;
  title: string;
  summary: string;
  fullText?: string;
  changeType: RegulatoryChangeType;
  classification: RegulatoryClassification;
  jurisdiction: string;
  affectedFrameworks?: string[];
  affectedModules?: string[];
  effectiveDate?: string;
  publishedAt?: string;
  sourceUrl?: string;
  nlpClassification: Record<string, unknown>;
  relevanceScore?: number;
  aiSummary?: string;
  status: RegulatoryChangeStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  isNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryImpactAssessment {
  id: string;
  changeId: string;
  orgId: string;
  impactLevel: ImpactLevel;
  impactAreas: ImpactArea[];
  affectedControls: AffectedEntity[];
  affectedProcesses: AffectedEntity[];
  requiredActions: RequiredAction[];
  estimatedEffort?: string;
  complianceDeadline?: string;
  aiReasoning?: string;
  confidenceScore?: number;
  status: ImpactAssessmentStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImpactArea {
  module: string;
  area: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface AffectedEntity {
  entityId: string;
  impact: string;
}

export interface RequiredAction {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  deadline?: string;
}

export interface RegulatoryCalendarEvent {
  id: string;
  orgId: string;
  changeId?: string;
  title: string;
  description?: string;
  eventType: RegulatoryCalendarEventType;
  eventDate: string;
  jurisdiction?: string;
  framework?: string;
  priority: CalendarPriority;
  reminderDays: number;
  isCompleted: boolean;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryDigest {
  id: string;
  orgId: string;
  periodStart: string;
  periodEnd: string;
  digestType: DigestType;
  summary: string;
  changeCount: number;
  criticalCount: number;
  highlights: DigestHighlight[];
  recipients: DigestRecipient[];
  sentAt?: string;
  createdAt: string;
}

export interface DigestHighlight {
  title: string;
  classification: RegulatoryClassification;
  relevance: number;
}

export interface DigestRecipient {
  userId: string;
  email: string;
  sentAt?: string;
}

export interface RegulatoryChangeDashboard {
  totalSources: number;
  activeSources: number;
  totalChanges: number;
  newChanges: number;
  criticalChanges: number;
  pendingAssessments: number;
  upcomingDeadlines: RegulatoryCalendarEvent[];
  recentChanges: RegulatoryChange[];
}
