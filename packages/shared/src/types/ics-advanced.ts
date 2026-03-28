// Sprint 40: ICS Advanced Types

export interface CCMConnector {
  id: string;
  orgId: string;
  name: string;
  connectorType: string;
  config: Record<string, unknown>;
  credentialRef?: string;
  targetControlIds: string[];
  schedule: "hourly" | "daily" | "weekly";
  evaluationRules: Array<{
    field: string;
    operator: string;
    expectedValue: unknown;
    threshold?: number;
  }>;
  isActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: string;
}

export interface CCMEvidence {
  id: string;
  connectorId: string;
  controlId: string;
  collectedAt: string;
  rawData: Record<string, unknown>;
  evaluationResult: "pass" | "fail" | "degraded" | "error";
  evaluationDetail?: string;
  score?: number;
}

export interface CCMDashboardData {
  totalMonitored: number;
  passCount: number;
  failCount: number;
  degradedCount: number;
  errorCount: number;
  controls: Array<{
    controlId: string;
    controlTitle: string;
    latestResult: string;
    latestScore: number;
    trendDirection: "improving" | "stable" | "declining";
  }>;
}

export interface SOXScope {
  id: string;
  fiscalYear: number;
  status: "draft" | "finalized" | "approved";
  inScopeProcessIds: string[];
  inScopeAccounts: Array<{ name: string; significance: string; balance?: number }>;
}

export interface SOXWalkthrough {
  id: string;
  controlId: string;
  fiscalYear: number;
  narrative: string;
  controlDesignEffective?: boolean;
  performedBy?: string;
  reviewedBy?: string;
}

export interface ControlDeficiency {
  id: string;
  controlId: string;
  title: string;
  classification: "deficiency" | "significant_deficiency" | "material_weakness";
  remediationStatus: "open" | "in_progress" | "remediated" | "retesting" | "closed" | "accepted";
  rootCauseMethod?: string;
  rootCause?: string;
  remediationDeadline?: string;
  retestResult?: "pass" | "fail";
}

export interface ControlLibraryEntry {
  id: string;
  controlRef: string;
  title: Record<string, string>;
  description: Record<string, string>;
  category: string;
  controlType: string;
  frequency?: string;
  automatable: boolean;
  frameworkMappings: Array<{ framework: string; controlRef: string }>;
}

export interface ThreeLinesDashboard {
  firstLine: { controlCount: number; processCount: number; riskCount: number };
  secondLine: { controlCount: number; processCount: number; riskCount: number };
  thirdLine: { controlCount: number; processCount: number; riskCount: number };
  unassigned: { controlCount: number; processCount: number; riskCount: number };
  coverageGaps: Array<{
    entityType: string;
    entityId: string;
    entityTitle: string;
    gapType: string;
  }>;
}

export interface SOXTestingPlan {
  fiscalYear: number;
  controls: Array<{
    controlId: string;
    controlTitle: string;
    frequency: string;
    sampleSize: number;
    walkthroughComplete: boolean;
    testingComplete: boolean;
  }>;
}
