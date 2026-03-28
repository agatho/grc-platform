// Sprint 47: BPM Advanced Types

export interface ProcessEventLog {
  id: string;
  orgId: string;
  processId?: string;
  importName: string;
  formatSource: "csv" | "xes";
  eventCount?: number;
  caseCount?: number;
  activityCount?: number;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  status: "importing" | "ready" | "error";
  errorMessage?: string;
}

export interface ProcessEvent {
  id: string;
  eventLogId: string;
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string;
  additionalData?: Record<string, unknown>;
}

export interface DirectlyFollowsGraph {
  nodes: DfgNode[];
  edges: DfgEdge[];
}

export interface DfgNode {
  activity: string;
  frequency: number;
  avgDurationMs?: number;
}

export interface DfgEdge {
  from: string;
  to: string;
  frequency: number;
  avgDurationMs: number;
  isBottleneck: boolean;
  isRework: boolean;
}

export interface ProcessConformanceResult {
  id: string;
  eventLogId: string;
  processId?: string;
  conformanceScore: number;
  totalTraces: number;
  conformantTraces: number;
  fitnessGaps: FitnessGap[];
  precisionIssues: PrecisionIssue[];
  reworkLoops: ReworkLoop[];
  bottlenecks: Bottleneck[];
}

export interface FitnessGap {
  activity: string;
  type: "unexpected" | "missing_in_model";
  frequency: number;
  percentage: number;
}

export interface PrecisionIssue {
  activity: string;
  type: "never_executed";
}

export interface ReworkLoop {
  fromActivity: string;
  toActivity: string;
  frequency: number;
  percentage: number;
}

export interface Bottleneck {
  transition: string;
  avgDurationMs: number;
  percentOfTotal: number;
}

export interface ProcessMiningSuggestion {
  id: string;
  conformanceResultId: string;
  suggestionType: "add_activity" | "remove_activity" | "add_path" | "modify_path";
  description: string;
  evidenceFrequency?: number;
  status: "pending" | "accepted" | "rejected";
}

export interface ProcessKpiDefinition {
  id: string;
  orgId: string;
  processId: string;
  name: string;
  metricType: "cycle_time" | "cost" | "throughput" | "error_rate" | "compliance_rate" | "custom";
  unit: string;
  targetValue: number;
  thresholdGreen: number;
  thresholdYellow: number;
  measurementPeriod: "daily" | "weekly" | "monthly" | "quarterly";
  dataSource: "manual" | "mining" | "api";
  apiConfig?: { url: string; method: string; jsonPath: string };
  ownerId?: string;
  isActive: boolean;
}

export interface ProcessKpiMeasurement {
  id: string;
  kpiDefinitionId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number;
  targetValue: number;
  status: "green" | "yellow" | "red";
  dataSourceDetail?: string;
  measuredBy?: string;
}

export interface ProcessMaturityAssessment {
  id: string;
  orgId: string;
  processId: string;
  assessmentDate: string;
  overallLevel: number;
  dimensionScores: Record<string, number>;
  targetLevel?: number;
  gapActions: MaturityGapAction[];
}

export interface MaturityGapAction {
  dimension: string;
  action: string;
  priority: "low" | "medium" | "high";
  status?: "pending" | "in_progress" | "completed";
  ownerId?: string;
  deadline?: string;
}

export interface MaturityQuestionnaireItem {
  id: string;
  dimension: "documentation" | "adherence" | "measurement" | "improvement" | "satisfaction";
  questionNumber: number;
  questionText: { en: string; de: string };
  levelMapping: number;
  weight: number;
}

export interface ValueStreamMap {
  id: string;
  orgId: string;
  processId: string;
  mapType: "current_state" | "future_state";
  title: string;
  diagramData: VsmDiagramData;
  totalLeadTimeMinutes?: number;
  totalValueAddMinutes?: number;
  valueAddRatio?: number;
  wasteAnalysis: WasteEntry[];
  version: number;
  status: "draft" | "reviewed" | "published";
}

export interface VsmDiagramData {
  steps: VsmStep[];
  informationFlows?: Array<{ from: string; to: string; type: string }>;
  materialFlows?: Array<{ from: string; to: string; inventoryCount?: number }>;
}

export interface VsmStep {
  id: string;
  name: string;
  cycleTimeMinutes: number;
  waitTimeMinutes: number;
  changeoverTimeMinutes?: number;
  uptime?: number;
  operators?: number;
  wasteTags?: string[];
}

export interface WasteEntry {
  wasteType: string;
  timeMinutes: number;
  percentage: number;
}

export interface VsmComparison {
  currentState: ValueStreamMap;
  futureState: ValueStreamMap;
  leadTimeReduction: number;
  leadTimeReductionPercent: number;
  valueAddRatioImprovement: number;
}

export interface ProcessTemplate {
  id: string;
  domain: "finance" | "hr" | "it" | "compliance" | "operations" | "procurement";
  name: { en: string; de: string };
  description?: { en: string; de: string };
  bpmnXml: string;
  typicalKpis: Array<{ name: string; metricType: string; typicalTarget: number }>;
  typicalRisks: Array<{ title: string; category: string; typicalLikelihood: number; typicalImpact: number }>;
  typicalControls: Array<{ title: string; type: string; frequency: string }>;
  requiredRoles: string[];
  complexity: "simple" | "moderate" | "complex";
  isPublished: boolean;
}
