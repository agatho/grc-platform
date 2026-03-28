// Sprint 75: Regulatory Horizon Scanner Types

export type HorizonSourceType = "eu_oj" | "bsi" | "bafin" | "enisa" | "eba" | "esma" | "cert" | "national_gazette" | "custom";
export type HorizonParserType = "rss" | "html_scraper" | "api" | "email" | "manual";
export type HorizonItemType = "regulation" | "directive" | "guideline" | "consultation" | "enforcement" | "standard" | "alert";
export type HorizonClassification = "critical" | "high" | "medium" | "low" | "informational";
export type HorizonItemStatus = "new" | "triaged" | "under_review" | "assessed" | "acknowledged" | "dismissed";
export type HorizonImpactLevel = "critical" | "high" | "medium" | "low" | "none";
export type HorizonAssessmentStatus = "draft" | "in_review" | "approved" | "rejected";
export type HorizonCalendarEventType = "compliance_deadline" | "enforcement_date" | "consultation_end" | "reporting_deadline" | "transition_period";
export type HorizonPriority = "critical" | "high" | "medium" | "low";

export interface HorizonScanSource {
  id: string;
  orgId?: string;
  name: string;
  sourceType: HorizonSourceType;
  url?: string;
  jurisdiction: string;
  regulatoryBody?: string;
  frameworks?: string[];
  fetchFrequencyHours: number;
  parserType: HorizonParserType;
  parserConfig: Record<string, unknown>;
  nlpModel?: string;
  isActive: boolean;
  lastFetchedAt?: string;
  lastFetchError?: string;
  totalItemsFetched: number;
  createdAt: string;
  updatedAt: string;
}

export interface HorizonScanItem {
  id: string;
  orgId: string;
  sourceId?: string;
  externalId?: string;
  title: string;
  summary: string;
  fullText?: string;
  itemType: HorizonItemType;
  classification: HorizonClassification;
  jurisdiction: string;
  regulatoryBody?: string;
  affectedFrameworks?: string[];
  affectedModules?: string[];
  effectiveDate?: string;
  consultationEndDate?: string;
  publishedAt?: string;
  sourceUrl?: string;
  nlpTopics: HorizonNlpTopic[];
  nlpEntities: HorizonNlpEntity[];
  nlpSentiment?: string;
  relevanceScore?: number;
  aiSummary?: string;
  suggestedControls: HorizonSuggestedControl[];
  status: HorizonItemStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HorizonNlpTopic {
  topic: string;
  confidence: number;
}

export interface HorizonNlpEntity {
  entity: string;
  type: string;
  relevance: number;
}

export interface HorizonSuggestedControl {
  controlId: string;
  controlName: string;
  reason: string;
}

export interface HorizonImpactAssessment {
  id: string;
  orgId: string;
  scanItemId: string;
  impactLevel: HorizonImpactLevel;
  impactAreas: HorizonImpactArea[];
  affectedControls: Record<string, unknown>[];
  affectedProcesses: Record<string, unknown>[];
  requiredActions: HorizonRequiredAction[];
  estimatedEffort?: string;
  complianceDeadline?: string;
  aiReasoning?: string;
  confidenceScore?: number;
  assessedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  status: HorizonAssessmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HorizonImpactArea {
  module: string;
  area: string;
  description: string;
  severity: string;
}

export interface HorizonRequiredAction {
  action: string;
  priority: string;
  deadline: string;
  assignee: string;
}

export interface HorizonCalendarEvent {
  id: string;
  orgId: string;
  scanItemId?: string;
  title: string;
  description?: string;
  eventType: HorizonCalendarEventType;
  eventDate: string;
  jurisdiction?: string;
  framework?: string;
  priority: HorizonPriority;
  reminderDays: number;
  isCompleted: boolean;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HorizonScannerDashboard {
  totalSources: number;
  activeSources: number;
  totalItems: number;
  newItems: number;
  criticalItems: number;
  pendingAssessments: number;
  upcomingDeadlines: HorizonCalendarEvent[];
  recentItems: HorizonScanItem[];
  itemsByClassification: Record<HorizonClassification, number>;
  itemsByJurisdiction: Record<string, number>;
}
