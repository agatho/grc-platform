// Sprint 31: Regulatory Simulator + Attack Path Visualization Types

// ──────────────────────────────────────────────────────────────
// Scenario Types
// ──────────────────────────────────────────────────────────────

export type SimulationScenarioType =
  | "add_requirement"
  | "tighten"
  | "shorten_deadline"
  | "add_reporting";

// ──────────────────────────────────────────────────────────────
// Simulation Gap
// ──────────────────────────────────────────────────────────────

export interface SimulationGap {
  requirement: string;
  missingControl: string;
  effort: "S" | "M" | "L" | "XL";
  estimatedCost: number;
}

// ──────────────────────────────────────────────────────────────
// Timeline Milestone
// ──────────────────────────────────────────────────────────────

export interface TimelineMilestone {
  milestone: string;
  deadline: string;
  status: "pending" | "in_progress" | "completed";
}

// ──────────────────────────────────────────────────────────────
// Regulation Simulation
// ──────────────────────────────────────────────────────────────

export interface RegulationSimulation {
  id: string;
  orgId: string;
  regulationName: string;
  scenarioType: SimulationScenarioType;
  parametersJson: Record<string, unknown>;
  beforeScore: string;
  afterScore: string;
  gapCount: number;
  gapsJson: SimulationGap[];
  estimatedTotalCost: string | null;
  timelineJson: TimelineMilestone[] | null;
  createdBy: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// Attack Path Types
// ──────────────────────────────────────────────────────────────

export interface AttackPathHop {
  assetId: string;
  assetName: string;
  cveIds: string[];
  controlGaps: string[];
  hopProbability: number;
}

export interface BlockingControl {
  controlId: string;
  controlName: string;
  wouldEliminatePaths: number;
}

export interface AttackPathResult {
  id: string;
  orgId: string;
  entryAssetId: string;
  targetAssetId: string;
  pathJson: AttackPathHop[];
  hopCount: number;
  riskScore: string;
  blockingControlsJson: BlockingControl[] | null;
  computedAt: string;
  batchId: string;
}

// ──────────────────────────────────────────────────────────────
// Simulation Comparison
// ──────────────────────────────────────────────────────────────

export interface SimulationComparison {
  simulationA: RegulationSimulation;
  simulationB: RegulationSimulation;
  scoreDelta: number;
  gapCountDelta: number;
  costDelta: number;
}

// ──────────────────────────────────────────────────────────────
// Attack Path Comparison
// ──────────────────────────────────────────────────────────────

export interface AttackPathComparison {
  before: AttackPathResult[];
  after: AttackPathResult[];
  eliminated: number;
  shortened: number;
  newPaths: number;
}
