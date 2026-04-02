// Sprint 36: Enterprise Architecture Management (EAM) types

export type ArchitectureLayer = "business" | "application" | "technology";
export type ArchitectureType =
  | "business_capability" | "business_service" | "business_function"
  | "application" | "app_service" | "app_interface" | "app_component" | "data_object"
  | "server" | "network" | "cloud_service" | "database" | "infrastructure_service";
export type ArchRelationshipType = "realizes" | "serves" | "runs_on" | "accesses" | "flows_to" | "composes" | "depends_on" | "deployed_on" | "uses";
export type ElementStatus = "planned" | "active" | "phase_out" | "retired";
export type EamCriticality = "critical" | "important" | "normal" | "low";
export type LifecycleStatus = "planned" | "active" | "phase_out" | "end_of_life" | "retired";
export type TimeClassification = "tolerate" | "invest" | "migrate" | "eliminate";
export type LicenseType = "saas" | "on_premise" | "hybrid" | "open_source";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type StrategicImportance = "core" | "supporting" | "commodity";
export type ViolationStatus = "open" | "acknowledged" | "resolved" | "false_positive";

export interface ArchitectureElement {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  layer: ArchitectureLayer;
  type: ArchitectureType;
  assetId?: string;
  processId?: string;
  owner?: string;
  department?: string;
  status: ElementStatus;
  criticality: EamCriticality;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureRelationship {
  id: string;
  orgId: string;
  sourceId: string;
  targetId: string;
  relationshipType: ArchRelationshipType;
  criticality?: string;
  dataFlowDirection?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

export interface BusinessCapability {
  id: string;
  orgId: string;
  elementId: string;
  parentId?: string;
  level: number;
  sortOrder: number;
  maturityLevel?: number;
  strategicImportance?: StrategicImportance;
  element?: ArchitectureElement;
  children?: BusinessCapability[];
}

export interface ApplicationPortfolio {
  id: string;
  elementId: string;
  orgId: string;
  vendorName?: string;
  vendorId?: string;
  version?: string;
  licenseType?: LicenseType;
  plannedIntroduction?: string;
  goLiveDate?: string;
  plannedEol?: string;
  lifecycleStatus: LifecycleStatus;
  timeClassification?: TimeClassification;
  businessValue?: number;
  technicalCondition?: number;
  annualCost?: number;
  userCount?: number;
  costCenter?: string;
  hasApi?: boolean;
  authMethod?: string;
  dataClassification?: DataClassification;
}

export interface ApplicationWithPortfolio {
  element: ArchitectureElement;
  portfolio?: ApplicationPortfolio;
}

export interface ArchitectureRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  ruleType: string;
  condition: Record<string, unknown>;
  severity: string;
  isActive: boolean;
  lastEvaluatedAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ArchitectureRuleViolation {
  id: string;
  ruleId: string;
  elementId: string;
  orgId: string;
  violationDetail?: string;
  detectedAt: string;
  resolvedAt?: string;
  status: ViolationStatus;
}

export interface DiagramNode {
  id: string;
  name: string;
  layer: ArchitectureLayer;
  type: ArchitectureType;
  status: ElementStatus;
  criticality: EamCriticality;
  x?: number;
  y?: number;
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: ArchRelationshipType;
  criticality?: string;
}

export interface ThreeLayerDiagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface SpofResult {
  elementId: string;
  elementName: string;
  criticalCapabilities: number;
  dependentApplications: number;
}

export interface PortfolioQuadrantData {
  id: string;
  name: string;
  businessValue: number;
  technicalCondition: number;
  annualCost: number;
  userCount: number;
  timeClassification?: TimeClassification;
  lifecycleStatus: LifecycleStatus;
}

// ──────────────────────────────────────────────────────────
// Layer-Type validation mapping
// ──────────────────────────────────────────────────────────

export const LAYER_TYPE_MAP: Record<ArchitectureLayer, ArchitectureType[]> = {
  business: ["business_capability", "business_service", "business_function"],
  application: ["application", "app_service", "app_interface", "app_component", "data_object"],
  technology: ["server", "network", "cloud_service", "database", "infrastructure_service"],
};
