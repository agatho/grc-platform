// ESG/CSRD Module types (Sprint 10)
export type MaterialityStatus = "draft" | "in_progress" | "completed";
export type DataQuality = "measured" | "estimated" | "calculated";
export type TargetType = "absolute" | "intensity" | "relative";
export type TargetStatus = "on_track" | "at_risk" | "off_track" | "achieved";
export type ReportStatus = "draft" | "in_review" | "approved" | "published";
export type EsgFrequency = "annual" | "semi_annual" | "quarterly";
export type VoterType =
  | "internal"
  | "customer"
  | "supplier"
  | "investor"
  | "ngo"
  | "regulator";

export interface EsgMaterialityAssessment {
  id: string;
  orgId: string;
  reportingYear: number;
  status: MaterialityStatus;
  startedAt?: string;
  completedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsgMaterialityTopic {
  id: string;
  assessmentId: string;
  esrsStandard: string;
  topicName: string;
  impactScore?: number;
  financialScore?: number;
  isMaterial?: boolean;
  justification?: string;
  stakeholderConsensus?: number;
}

export interface EsgMaterialityVote {
  id: string;
  topicId: string;
  voterId?: string;
  voterName?: string;
  voterType: VoterType;
  impactScore: number;
  financialScore: number;
  comment?: string;
  votedAt: string;
}

export interface EsrsDatapointDefinition {
  id: string;
  esrsStandard: string;
  disclosureRequirement: string;
  datapointCode: string;
  nameDe: string;
  nameEn: string;
  descriptionDe?: string;
  descriptionEn?: string;
  dataType: string;
  unit?: string;
  isMandatory: boolean;
  frequency?: string;
  calculationMethod?: string;
  relatedTopics?: string[];
}

export interface EsrsMetric {
  id: string;
  orgId: string;
  datapointId: string;
  name: string;
  unit: string;
  frequency: EsgFrequency;
  collectionMethod?: string;
  calculationFormula?: string;
  responsibleUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EsgMeasurement {
  id: string;
  orgId: string;
  metricId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  unit: string;
  dataQuality: DataQuality;
  source?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  recordedAt: string;
}

export interface EsgTarget {
  id: string;
  orgId: string;
  metricId: string;
  name: string;
  baselineYear: number;
  baselineValue: number;
  targetYear: number;
  targetValue: number;
  targetType: TargetType;
  sbtiAligned: boolean;
  status: TargetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EsgControlLink {
  id: string;
  orgId: string;
  datapointId: string;
  controlId: string;
  notes?: string;
  createdAt: string;
}

export interface EsgAnnualReport {
  id: string;
  orgId: string;
  reportingYear: number;
  status: ReportStatus;
  completenessPercent?: number;
  exportedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
