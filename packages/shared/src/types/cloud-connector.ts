// Sprint 63: Cloud Infrastructure Connectors types

export type CloudProvider = "aws" | "azure" | "gcp";

export type CloudTestExecutionStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type CloudTestTrigger = "schedule" | "manual" | "api";

export type TrendDirection = "up" | "down" | "stable";

export interface CloudTestSuite {
  id: string;
  orgId: string;
  connectorId: string;
  provider: CloudProvider;
  suiteName: string;
  description?: string | null;
  testKeys: string[];
  isEnabled: boolean;
  lastRunAt?: string | null;
  lastPassRate?: number | null;
  totalTests: number;
  passingTests: number;
  failingTests: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudTestExecution {
  id: string;
  orgId: string;
  suiteId: string;
  connectorId: string;
  provider: CloudProvider;
  status: CloudTestExecutionStatus;
  totalTests: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  skipCount: number;
  passRate?: number | null;
  durationMs?: number | null;
  results: CloudTestResultEntry[];
  triggeredBy: CloudTestTrigger;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

export interface CloudTestResultEntry {
  testKey: string;
  testName: string;
  status: "pass" | "fail" | "error" | "skip";
  findings: Array<{
    severity: string;
    message: string;
    resource?: string;
  }>;
  durationMs?: number;
}

export interface CloudComplianceSnapshot {
  id: string;
  orgId: string;
  connectorId: string;
  provider: CloudProvider;
  snapshotDate: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  totalChecks: number;
  passingChecks: number;
  failingChecks: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  trendDirection?: TrendDirection | null;
  trendDelta?: number | null;
  createdAt: string;
}

export interface CloudDashboardStats {
  providers: Array<{
    provider: CloudProvider;
    connectorCount: number;
    overallScore: number;
    trend: TrendDirection;
    criticalFindings: number;
  }>;
  totalTests: number;
  passRate: number;
  lastScanDate?: string | null;
}
