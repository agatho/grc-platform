// Sprint 29: Knowledge Graph core types

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  status?: string;
  severity?: string;
  connectionCount: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  relationship: string;
  weight: number;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    rootId: string;
    rootType: string;
    depth: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface RawTraversalRow {
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  relationship: string;
  weight: number;
  depth: number;
  path: string[];
}

export interface AffectedEntity {
  entityId: string;
  entityType: string;
  entityName: string;
  hopDistance: number;
  impactScore: number;
  path: string[];
}

export interface ImpactResult {
  sourceEntity: { id: string; type: string; name: string };
  affectedEntities: AffectedEntity[];
  totalImpactScore: number;
  criticalPaths: string[][];
  maxDepth: number;
}

export type ScenarioType =
  | "control_disabled"
  | "vendor_terminated"
  | "asset_compromised"
  | "process_stopped";

export interface DeltaResult {
  newlyAffected: AffectedEntity[];
  increasedImpact: Array<{
    entityId: string;
    entityType: string;
    beforeScore: number;
    afterScore: number;
    delta: number;
  }>;
  severedEdges: GraphEdge[];
}

export interface WhatIfResult {
  scenario: ScenarioType;
  entityId: string;
  before: ImpactResult;
  after: ImpactResult;
  delta: DeltaResult;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByRelationship: Record<string, number>;
  orphanCount: number;
  hubCount: number;
  avgConnections: number;
}

export interface OrphanEntity {
  entityId: string;
  entityType: string;
  entityName: string;
  elementId?: string;
  missingRelationship: string;
  fixUrl: string;
}

export interface HubEntity {
  entityId: string;
  entityType: string;
  entityName: string;
  connectionCount: number;
  inbound: number;
  outbound: number;
  isSinglePointOfFailure: boolean;
}

export interface DependencyMatrixEntry {
  sourceType: string;
  targetType: string;
  count: number;
  avgWeight: number;
}

export const RELATIONSHIP_WEIGHTS: Record<string, number> = {
  mitigates: 90,
  affects: 80,
  affected: 80,
  owned_by: 70,
  tested_by: 60,
  assessed_in: 60,
  depends_on: 50,
  linked_to: 50,
  implemented_in: 50,
  bound_by: 50,
  found_in: 40,
  documented_in: 30,
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  risk: "#ef4444",
  control: "#3b82f6",
  asset: "#22c55e",
  process: "#f97316",
  vendor: "#a855f7",
  document: "#eab308",
  audit: "#6b7280",
  incident: "#dc2626",
  finding: "#f59e0b",
  kri: "#ec4899",
  bcp: "#14b8a6",
  ropa_entry: "#8b5cf6",
  dpia: "#06b6d4",
  contract: "#64748b",
  process_step: "#fb923c",
};

export const MAX_GRAPH_DEPTH = 5;
export const DEFAULT_GRAPH_DEPTH = 3;
export const IMPACT_DECAY_FACTOR = 0.6;
export const IMPACT_NOISE_THRESHOLD = 5;
export const HUB_CONNECTION_THRESHOLD = 10;
