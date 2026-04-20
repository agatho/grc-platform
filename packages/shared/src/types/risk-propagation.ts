// Sprint 32: Risk Propagation + Incident Correlation Types

// ──────────────────────────────────────────────────────────────
// Relationship Types
// ──────────────────────────────────────────────────────────────

export type OrgRelationshipType =
  | "shared_it"
  | "shared_vendor"
  | "shared_process"
  | "financial_dependency"
  | "data_flow";

// ──────────────────────────────────────────────────────────────
// Propagation Types
// ──────────────────────────────────────────────────────────────

export type PropagationType = "causal" | "correlated" | "amplifying";

// ──────────────────────────────────────────────────────────────
// OrgEntityRelationship
// ──────────────────────────────────────────────────────────────

export interface OrgEntityRelationship {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  relationshipType: OrgRelationshipType;
  strength: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Propagation Result
// ──────────────────────────────────────────────────────────────

export interface PropagationResultEntry {
  riskId: string;
  orgId: string;
  level: number;
  propagatedScore: number;
  delta: number;
  via: OrgRelationshipType;
}

export interface RiskPropagationResult {
  id: string;
  orgId: string;
  sourceRiskId: string;
  batchId: string;
  resultsJson: PropagationResultEntry[];
  totalAffectedEntities: number;
  maxDepth: number;
  computedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Correlation Types
// ──────────────────────────────────────────────────────────────

export type CorrelationType = "temporal" | "asset" | "pattern" | "mitre";

export interface SharedFactor {
  factor: string;
  description: string;
}

export interface IncidentCorrelation {
  id: string;
  orgId: string;
  correlationType: CorrelationType;
  incidentIds: string[];
  campaignName: string | null;
  confidence: number;
  reasoning: string | null;
  mitreAttackTechniques: string[];
  sharedFactorsJson: SharedFactor[] | null;
  detectedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Propagation Simulation Input/Output
// ──────────────────────────────────────────────────────────────

export interface PropagationSimulationInput {
  riskId: string;
  simulatedLikelihood: number;
}

export interface PropagationSimulationResult {
  sourceRiskId: string;
  affectedEntities: PropagationResultEntry[];
  totalCascadeDamage: number | null;
}

// ──────────────────────────────────────────────────────────────
// Correlation Matrix
// ──────────────────────────────────────────────────────────────

export interface CorrelationMatrixEntry {
  categoryA: string;
  categoryB: string;
  coefficient: number;
  incidentCount: number;
}

export interface DetectedPattern {
  description: string;
  confidence: "high" | "medium" | "low";
  occurrences: number;
  intervalDays: number | null;
}
