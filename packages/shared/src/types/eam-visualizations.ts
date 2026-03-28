// Sprint 49: EAM Visualizations types

export type LifecyclePhase = "planning" | "implementing" | "phase_in" | "active" | "phase_out" | "inactive";
export type GridColoringMode = "lifecycle" | "time" | "six_r" | "criticality" | "functional_fit";
export type OverlayMode = "none" | "risk" | "vulnerability";
export type RoadmapGroupBy = "lifecycle" | "capability" | "department" | "category" | "time" | "six_r";
export type ContextDiagramSector = "business" | "organization" | "integration" | "data" | "technology" | "risk" | "provider";

export interface InsightGridData {
  columns: GridColumn[];
  rows: GridRow[];
  cells: Record<string, Record<string, GridCell[]>>;
  timeReference: string;
}

export interface GridColumn {
  id: string;
  name: string;
  elementId: string;
}

export interface GridRow {
  id: string;
  name: string;
  type: string;
}

export interface GridCell {
  applicationId: string;
  name: string;
  lifecyclePhase: LifecyclePhase;
  timeClassification?: string;
  sixRStrategy?: string;
  businessCriticality?: string;
  functionalFit?: string;
  annualCost?: number;
  riskSeverity?: string;
  cveCount?: number;
}

export interface ContextDiagramData {
  centralNode: ContextDiagramNode;
  sectors: Record<ContextDiagramSector, ContextDiagramNode[]>;
  edges: ContextDiagramEdge[];
}

export interface ContextDiagramNode {
  id: string;
  name: string;
  type: string;
  sector: ContextDiagramSector;
  lifecyclePhase?: LifecyclePhase;
  riskCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ContextDiagramEdge {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  label?: string;
}

export interface RoadmapData {
  entries: RoadmapEntry[];
  groups: RoadmapGroup[];
  timeRange: { start: string; end: string };
}

export interface RoadmapEntry {
  id: string;
  name: string;
  group: string;
  phases: RoadmapPhase[];
  lifecycleStatus: string;
  timeClassification?: string;
  sixRStrategy?: string;
  replacesId?: string;
}

export interface RoadmapPhase {
  phase: LifecyclePhase;
  start: string | null;
  end: string | null;
}

export interface RoadmapGroup {
  key: string;
  label: string;
  count: number;
  totalCost?: number;
}

export interface RiskPerAppData {
  applications: AppRiskEntry[];
  totalRisks: number;
  criticalRisks: number;
}

export interface AppRiskEntry {
  appId: string;
  appName: string;
  risksByCategory: Record<string, number>;
  risksByRating: Record<string, number>;
  totalRisks: number;
}

export interface VulnerabilityMonitorData {
  totalCves: number;
  criticalUnpatched: number;
  highUnpatched: number;
  patchedPct: number;
  perApplication: AppVulnerabilityEntry[];
}

export interface AppVulnerabilityEntry {
  appId: string;
  appName: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  patchedPct: number;
  lastScanDate?: string;
}

export interface BusinessAlignmentData {
  capabilities: AlignmentCapability[];
  coverageScorePct: number;
}

export interface AlignmentCapability {
  capabilityId: string;
  capabilityName: string;
  applicationCount: number;
  status: "full" | "partial" | "none";
}

export interface TechnicalAlignmentData {
  standardPct: number;
  standardCount: number;
  nonStandardCount: number;
  nonStandardTechnologies: NonStandardTech[];
}

export interface NonStandardTech {
  technologyId: string;
  technologyName: string;
  ring: string;
  applicationCount: number;
  recommendedAction: string;
}

export const LIFECYCLE_COLORS: Record<LifecyclePhase, string> = {
  planning: "#B0BEC5",
  implementing: "#1565C0",
  phase_in: "#00897B",
  active: "#2E7D32",
  phase_out: "#E91E63",
  inactive: "#C62828",
};
