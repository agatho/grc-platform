// Sprint 29: Knowledge Graph + Impact Analysis types

// ─── Graph Node & Edge ────────────────────────────────────

export interface GraphNodeData {
  id: string;
  type: string;
  name: string;
  status?: string;
  severity?: string;
  connectionCount: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeData {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  relationship: string;
  weight: number;
}

export interface GraphMeta {
  rootId: string;
  rootType: string;
  depth: number;
  nodeCount: number;
  edgeCount: number;
}

export interface SubgraphResponse {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  meta: GraphMeta;
}

// ─── Impact Analysis ───────────────────────────────────────

export interface AffectedEntityData {
  entityId: string;
  entityType: string;
  entityName: string;
  hopDistance: number;
  impactScore: number;
  path: string[];
}

export interface ImpactAnalysisResponse {
  sourceEntity: { id: string; type: string; name: string };
  affectedEntities: AffectedEntityData[];
  totalImpactScore: number;
  criticalPaths: string[][];
  maxDepth: number;
}

// ─── What-If ───────────────────────────────────────────────

export type GraphScenarioType =
  | "control_disabled"
  | "vendor_terminated"
  | "asset_compromised"
  | "process_stopped";

export interface WhatIfDelta {
  newlyAffected: AffectedEntityData[];
  increasedImpact: Array<{
    entityId: string;
    entityType: string;
    beforeScore: number;
    afterScore: number;
    delta: number;
  }>;
  severedEdges: GraphEdgeData[];
}

export interface WhatIfResponse {
  scenario: GraphScenarioType;
  entityId: string;
  before: ImpactAnalysisResponse;
  after: ImpactAnalysisResponse;
  delta: WhatIfDelta;
}

// ─── Stats ─────────────────────────────────────────────────

export interface GraphStatsResponse {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByRelationship: Record<string, number>;
  orphanCount: number;
  hubCount: number;
  avgConnections: number;
}

export interface OrphanEntityData {
  entityId: string;
  entityType: string;
  entityName: string;
  elementId?: string;
  missingRelationship: string;
  fixUrl: string;
}

export interface OrphansResponse {
  risksWithoutControls: OrphanEntityData[];
  controlsWithoutTests: OrphanEntityData[];
  assetsWithoutProtection: OrphanEntityData[];
  processesWithoutControls: OrphanEntityData[];
}

export interface HubEntityData {
  entityId: string;
  entityType: string;
  entityName: string;
  connectionCount: number;
  inbound: number;
  outbound: number;
  isSinglePointOfFailure: boolean;
}

export interface DependencyMatrixEntryData {
  sourceType: string;
  targetType: string;
  count: number;
  avgWeight: number;
}

export interface EntitySearchResult {
  entityId: string;
  entityType: string;
  name: string;
  elementId?: string;
}

// ─── Graph Layout Options ──────────────────────────────────

export type GraphLayout = "force" | "hierarchical" | "radial" | "circular";

export const GRAPH_ENTITY_TYPES = [
  "risk",
  "control",
  "asset",
  "process",
  "vendor",
  "document",
  "finding",
  "incident",
  "audit",
  "kri",
  "bcp",
  "ropa_entry",
  "dpia",
  "contract",
  "process_step",
] as const;

export type GraphEntityType = (typeof GRAPH_ENTITY_TYPES)[number];

export const GRAPH_RELATIONSHIP_TYPES = [
  "mitigates",
  "linked_to",
  "depends_on",
  "owned_by",
  "documented_in",
  "tested_by",
  "assessed_in",
  "affects",
  "implemented_in",
  "found_in",
  "bound_by",
  "affected",
] as const;

export type GraphRelationshipType = (typeof GRAPH_RELATIONSHIP_TYPES)[number];

export const GRAPH_SCENARIO_TYPES: GraphScenarioType[] = [
  "control_disabled",
  "vendor_terminated",
  "asset_compromised",
  "process_stopped",
];

export const GRAPH_ENTITY_COLORS: Record<string, string> = {
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
