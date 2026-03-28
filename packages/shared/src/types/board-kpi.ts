// Sprint 23: Board KPIs types

export type BoardKpiRiskCategory =
  | "strategic"
  | "operational"
  | "financial"
  | "compliance"
  | "cyber"
  | "reputational"
  | "esg";

export type AssuranceModule =
  | "erm"
  | "isms"
  | "ics"
  | "dpms"
  | "audit"
  | "tprm"
  | "bcms"
  | "esg";

export type PostureDomain =
  | "organizational"
  | "people"
  | "physical"
  | "technological";

export interface RiskAppetiteThresholdRow {
  id: string;
  orgId: string;
  riskCategory: string;
  maxResidualScore: number;
  maxResidualAle?: string | null;
  escalationRole: string | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskAppetiteBreach {
  riskId: string;
  riskTitle: string;
  riskCategory: string;
  residualScore: number;
  appetiteThreshold: number;
  delta: number;
  ownerId?: string | null;
  ownerName?: string | null;
}

export interface RiskAppetiteDashboardItem {
  category: string;
  avgResidual: number;
  maxResidual: number;
  appetiteThreshold: number;
  riskCount: number;
  breachCount: number;
  isBreached: boolean;
}

export interface AssuranceFactors {
  evidenceAge: number;
  testCoverage: number;
  dataQuality: number;
  assessmentSource: number;
  automationLevel: number;
}

export interface AssuranceRecommendation {
  action: string;
  impactPercent: number;
}

export interface AssuranceModuleScore {
  module: string;
  score: number;
  factors: AssuranceFactors;
  recommendations: AssuranceRecommendation[];
  trend?: "improving" | "stable" | "declining";
}

export interface ModuleAssuranceData {
  avgEvidenceAgeDays: number;
  testedControls: number;
  totalControls: number;
  measuredCount: number;
  estimatedCount: number;
  thirdLinePercent: number;
  secondLinePercent: number;
  firstLinePercent: number;
  autoCollectedEvidence: number;
  totalEvidence: number;
}

export interface PostureFactors {
  assetCoverage: number;
  maturity: number;
  ces: number;
  vulnExposure: number;
  incidentTTR: number;
  freshness: number;
  soaCompleteness: number;
}

export interface PostureData {
  assetsWithPRQ: number;
  totalAssets: number;
  avgMaturity: number;
  avgCES: number;
  criticalVulns: number;
  highVulns: number;
  avgTTRDays: number;
  avgAssessmentAgeDays: number;
  assessedControls: number;
  totalAnnexAControls: number;
}

export interface SecurityPostureResult {
  overallScore: number;
  factors: PostureFactors;
  domainScores: Record<PostureDomain, number>;
}

export interface PostureDomainScore {
  domain: PostureDomain;
  score: number;
  controlCount: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface AssuranceTrendData {
  module: string;
  trend: TrendPoint[];
}
