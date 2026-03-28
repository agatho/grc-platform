// Sprint 26: ISMS Intelligence — CVE Feed, AI SoA Gap, AI Maturity Roadmap

// ─── CVE Feed Types ──────────────────────────────────────────

export type CveSeverity = "critical" | "high" | "medium" | "low" | "none";
export type CveMatchStatus = "new" | "acknowledged" | "mitigated" | "not_applicable";
export type SoaGapType = "not_covered" | "partial" | "full";
export type SoaSuggestionStatus = "pending" | "accepted" | "rejected";
export type SoaGapPriority = "critical" | "high" | "medium" | "low";
export type RoadmapEffort = "S" | "M" | "L";
export type RoadmapActionStatus = "proposed" | "in_progress" | "completed" | "dismissed";

export interface CveReference {
  url: string;
  source?: string;
}

export interface CveFeedItem {
  id: string;
  cveId: string;
  source: string;
  title: string;
  description?: string;
  cvssScore?: number;
  cvssSeverity?: CveSeverity;
  affectedCpes: string[];
  publishedAt: string;
  modifiedAt?: string;
  references: CveReference[];
  fetchedAt: string;
  createdAt: string;
}

export interface AssetCpe {
  id: string;
  assetId: string;
  orgId: string;
  cpeUri: string;
  vendor?: string;
  product?: string;
  version?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CveAssetMatch {
  id: string;
  cveId: string;
  assetId: string;
  orgId: string;
  matchedCpe?: string;
  status: CveMatchStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  linkedVulnerabilityId?: string;
  matchedAt: string;
  createdAt: string;
  updatedAt: string;
  // joined fields for display
  cveFeedItem?: CveFeedItem;
  assetName?: string;
}

// ─── CVE Dashboard KPIs ──────────────────────────────────────

export interface CveDashboardKpis {
  openMatches: number;
  criticalCves: number;
  affectedAssets: number;
  meanRemediationDays: number;
  newMatchesLast7Days: number;
  totalCvesInFeed: number;
  lastSyncAt?: string;
}

// ─── AI SoA Gap Analysis Types ───────────────────────────────

export interface SoaAiSuggestion {
  id: string;
  orgId: string;
  analysisRunId: string;
  framework: string;
  frameworkControlRef: string;
  frameworkControlTitle?: string;
  suggestedControlId?: string;
  confidence: number;
  gapType: SoaGapType;
  reasoning?: string;
  priority: SoaGapPriority;
  status: SoaSuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  // joined
  suggestedControlTitle?: string;
}

export interface SoaGapAnalysisResult {
  analysisRunId: string;
  framework: string;
  totalSuggestions: number;
  gapsByType: {
    not_covered: number;
    partial: number;
    full: number;
  };
  suggestions: SoaAiSuggestion[];
  analyzedAt: string;
}

// ─── AI Maturity Roadmap Types ───────────────────────────────

export interface MaturityRoadmapAction {
  id: string;
  orgId: string;
  roadmapRunId: string;
  domain: string;
  currentLevel: number;
  targetLevel: number;
  title: string;
  description?: string;
  effort: RoadmapEffort;
  effortFteMonths?: number;
  priority: number;
  quarter?: string;
  isQuickWin: boolean;
  dependencies: string[];
  status: RoadmapActionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MaturityRoadmapResult {
  roadmapRunId: string;
  totalActions: number;
  quickWins: number;
  actions: MaturityRoadmapAction[];
  generatedAt: string;
}
