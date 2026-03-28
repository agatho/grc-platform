// Sprint 66: Cross-Framework Auto-Mapping Engine types

export type FrameworkKey =
  | "ISO27001"
  | "NIS2"
  | "BSI"
  | "NIST_CSF"
  | "SOC2"
  | "TISAX"
  | "DORA"
  | "GDPR"
  | "COBIT"
  | "CIS";

export type MappingRelationshipType = "equal" | "subset" | "superset" | "intersect" | "not_related";

export type MappingSource = "nist_olir" | "manual" | "ai_suggested";

export type MappingRuleType = "override" | "addition" | "exclusion";

export type CoverageStatus = "covered" | "partially_covered" | "not_covered" | "not_applicable";

export type CoverageSource = "direct_assessment" | "mapped" | "inherited" | "manual";

export type EvidenceStatus = "fresh" | "stale" | "missing" | "not_required";

export type AssessmentResult = "effective" | "partially_effective" | "ineffective";

export type RiskExposure = "critical" | "high" | "medium" | "low";

export interface FrameworkMapping {
  id: string;
  sourceFramework: string;
  sourceControlId: string;
  sourceControlTitle?: string | null;
  targetFramework: string;
  targetControlId: string;
  targetControlTitle?: string | null;
  relationshipType: MappingRelationshipType;
  confidence: number;
  mappingSource: MappingSource;
  rationale?: string | null;
  isVerified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  isBuiltIn: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkMappingRule {
  id: string;
  orgId: string;
  mappingId?: string | null;
  sourceFramework: string;
  sourceControlId: string;
  targetFramework: string;
  targetControlId: string;
  ruleType: MappingRuleType;
  confidence?: number | null;
  rationale?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ControlFrameworkCoverage {
  id: string;
  orgId: string;
  controlId: string;
  framework: string;
  frameworkControlId: string;
  coverageStatus: CoverageStatus;
  coverageSource: CoverageSource;
  evidenceStatus: EvidenceStatus;
  lastAssessedAt?: string | null;
  assessmentResult?: AssessmentResult | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkGapAnalysis {
  id: string;
  orgId: string;
  framework: string;
  analysisDate: string;
  totalControls: number;
  coveredControls: number;
  partiallyCoveredControls: number;
  notCoveredControls: number;
  notApplicableControls: number;
  coveragePercentage: number;
  gapDetails: GapDetail[];
  prioritizedActions: PrioritizedAction[];
  riskExposure?: RiskExposure | null;
  estimatedEffortDays?: number | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface GapDetail {
  controlId: string;
  controlTitle: string;
  status: CoverageStatus;
  recommendation?: string;
}

export interface PrioritizedAction {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  effort: string;
  impact: string;
}

export interface FrameworkCoverageSnapshot {
  id: string;
  orgId: string;
  snapshotDate: string;
  frameworkScores: Record<string, { coverage: number; gaps: number }>;
  overallCoverage: number;
  totalFrameworks: number;
  fullyCompliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  heatmapData: Record<string, Record<string, number>>;
  trendData: Record<string, unknown>;
  createdAt: string;
}

export interface CrossFrameworkDashboard {
  overallCoverage: number;
  frameworkCount: number;
  frameworkScores: Array<{
    framework: FrameworkKey;
    coverage: number;
    gaps: number;
    trend: "up" | "down" | "stable";
  }>;
  topGaps: GapDetail[];
  lastAnalysisDate?: string | null;
}
