// Sprint 68: AI Evidence Review Agent Types

export type EvidenceReviewScope = "all" | "control" | "framework" | "custom";
export type EvidenceReviewJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type EvidenceClassification =
  | "compliant"
  | "partially_compliant"
  | "non_compliant"
  | "inconclusive";
export type EvidenceGapType =
  | "missing_evidence"
  | "outdated"
  | "incomplete"
  | "quality_issue";
export type EvidenceGapSeverity = "critical" | "high" | "medium" | "low";
export type EvidenceGapStatus =
  | "open"
  | "acknowledged"
  | "remediated"
  | "false_positive";

export interface EvidenceReviewJob {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  scope: EvidenceReviewScope;
  scopeFilter: Record<string, unknown>;
  status: EvidenceReviewJobStatus;
  totalArtifacts: number;
  reviewedArtifacts: number;
  compliantArtifacts: number;
  nonCompliantArtifacts: number;
  gapsIdentified: number;
  overallConfidence?: number;
  model?: string;
  totalTokensUsed: number;
  durationMs?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceReviewResult {
  id: string;
  jobId: string;
  orgId: string;
  evidenceId: string;
  controlId?: string;
  artifactName: string;
  classification: EvidenceClassification;
  confidenceScore: number;
  reasoning: string;
  requirements: EvidenceRequirementCheck[];
  completenessScore?: number;
  freshnessScore?: number;
  qualityScore?: number;
  suggestedImprovements: string[];
  aiDecisionLog: Record<string, unknown>;
  reviewedAt: string;
  createdAt: string;
}

export interface EvidenceRequirementCheck {
  requirement: string;
  met: boolean;
  evidenceExcerpt?: string;
}

export interface EvidenceReviewGap {
  id: string;
  jobId: string;
  orgId: string;
  controlId?: string;
  gapType: EvidenceGapType;
  severity: EvidenceGapSeverity;
  title: string;
  description: string;
  affectedRequirements: string[];
  suggestedRemediation?: string;
  findingId?: string;
  status: EvidenceGapStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface EvidenceReviewSummary {
  orgId: string;
  totalJobs: number;
  completedJobs: number;
  totalArtifactsReviewed: number;
  totalCompliant: number;
  totalNonCompliant: number;
  totalGaps: number;
  avgConfidence: number;
  openGaps: number;
  criticalGaps: number;
}

export interface EvidenceReviewDashboard {
  summary: EvidenceReviewSummary;
  recentJobs: EvidenceReviewJob[];
  topGaps: EvidenceReviewGap[];
  classificationBreakdown: Record<EvidenceClassification, number>;
}
