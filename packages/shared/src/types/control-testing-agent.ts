// Sprint 70: AI Control Testing Agent Types

export type AgentTestType = "automated" | "manual" | "hybrid";
export type TestConnectorType = "api" | "database" | "file_system" | "cloud";
export type TestFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "on_demand";
export type TestExecutionStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "error"
  | "cancelled";
export type AgentTestResult = "pass" | "fail" | "inconclusive";
export type AgentTestResultSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";
export type TestTriggeredBy = "manual" | "scheduled" | "agent";
export type ChecklistStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "archived";
export type AgentChecklistResult = "pass" | "fail" | "partial";
export type ChecklistItemResponse = "yes" | "no" | "na" | "partial";
export type LearningPatternType =
  | "common_failure"
  | "effective_test"
  | "false_positive"
  | "improvement";

export interface ControlTestScript {
  id: string;
  orgId: string;
  controlId: string;
  name: string;
  description?: string;
  testType: AgentTestType;
  scriptContent: string;
  steps: TestStep[];
  connectorType?: TestConnectorType;
  connectorConfig: Record<string, unknown>;
  frequency?: TestFrequency;
  expectedDurationMinutes?: number;
  severityMapping: Record<string, string>;
  isActive: boolean;
  version: number;
  aiGenerated: boolean;
  aiModel?: string;
  aiConfidence?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestStep {
  order: number;
  instruction: string;
  expectedResult?: string;
  isAutomated: boolean;
}

export interface ControlTestExecution {
  id: string;
  scriptId: string;
  orgId: string;
  controlId: string;
  status: TestExecutionStatus;
  result?: AgentTestResult;
  resultSeverity?: AgentTestResultSeverity;
  stepResults: StepResult[];
  summary?: string;
  aiAnalysis?: string;
  findingsGenerated: number;
  findingIds: string[];
  connectorLogs: ConnectorLog[];
  durationMs?: number;
  tokensUsed: number;
  executedBy?: string;
  triggeredBy: TestTriggeredBy;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface StepResult {
  stepOrder: number;
  status: "pass" | "fail" | "skip" | "error";
  actualResult?: string;
  evidence?: string;
}

export interface ConnectorLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ControlTestChecklist {
  id: string;
  orgId: string;
  controlId: string;
  name: string;
  description?: string;
  items: ChecklistItem[];
  totalItems: number;
  completedItems: number;
  status: ChecklistStatus;
  overallResult?: AgentChecklistResult;
  aiGenerated: boolean;
  assigneeId?: string;
  completedAt?: string;
  dueDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  order: number;
  question: string;
  guidance?: string;
  evidenceRequired: boolean;
  response?: ChecklistItemResponse;
  notes?: string;
}

export interface ControlTestLearning {
  id: string;
  orgId: string;
  controlId: string;
  patternType: LearningPatternType;
  pattern: LearningPattern;
  confidence: number;
  sampleSize: number;
  lastUpdatedFromExecution?: string;
  isApplied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPattern {
  description: string;
  conditions: Record<string, unknown>;
  frequency: number;
  lastSeen: string;
}

export interface ControlTestingDashboard {
  totalScripts: number;
  activeScripts: number;
  totalExecutions: number;
  passRate: number;
  failRate: number;
  totalChecklists: number;
  overdueChecklists: number;
  learningPatterns: number;
  recentExecutions: ControlTestExecution[];
  topFailures: Array<{
    controlId: string;
    failCount: number;
    lastFailed: string;
  }>;
}
