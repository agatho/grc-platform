// Sprint 50: EAM Data Architecture & Scenario Planning types

export type DataCategory = "master_data" | "transaction_data" | "reference_data" | "analytical_data";
export type DataClassificationLevel = "public" | "internal" | "confidential" | "restricted";
export type ContextType = "as_is" | "to_be" | "scenario" | "historical";
export type ContextStatus = "draft" | "active" | "archived";

export interface EamDataObject {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  dataCategory: DataCategory;
  classification: DataClassificationLevel;
  ownerApplicationId: string | null;
  dataFormat: string | null;
  volumeEstimate: string | null;
  qualityScore: number | null;
  retentionPeriod: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  children?: EamDataObject[];
}

export interface EamDataObjectCrud {
  id: string;
  dataObjectId: string;
  applicationId: string;
  orgId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  notes: string | null;
}

export interface CrudMatrixRow {
  dataObjectId: string;
  dataObjectName: string;
  applications: CrudMatrixCell[];
}

export interface CrudMatrixCell {
  applicationId: string;
  applicationName: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface DataLineageGraph {
  dataObject: EamDataObject;
  creators: string[];
  readers: string[];
  updaters: string[];
  deleters: string[];
  flows: DataLineageFlow[];
}

export interface DataLineageFlow {
  id: string;
  sourceAppId: string;
  targetAppId: string;
  name: string;
}

export interface EamContext {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  contextType: ContextType;
  validFrom: string | null;
  validTo: string | null;
  status: ContextStatus;
  isDefault: boolean;
  predecessorContextId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EamContextAttribute {
  id: string;
  contextId: string;
  elementId: string;
  orgId: string;
  functionalFit: string | null;
  technicalFit: string | null;
  timeClassification: string | null;
  sixRStrategy: string | null;
  businessCriticality: string | null;
  lifecycleStatus: string | null;
  notes: string | null;
}

export interface ContextDiff {
  contextA: string;
  contextB: string;
  diffs: ElementDiff[];
  totalChanged: number;
}

export interface ElementDiff {
  elementId: string;
  elementName?: string;
  changes: AttributeChange[];
}

export interface AttributeChange {
  field: string;
  valueA: string | null;
  valueB: string | null;
}

export interface EamOrgUnit {
  id: string;
  orgId: string;
  parentOrgUnitId: string | null;
  name: string;
  abbreviation: string | null;
  location: string | null;
  headUserId: string | null;
  headCount: number | null;
  createdAt: string;
  updatedAt: string;
  children?: EamOrgUnit[];
}

export interface EamBusinessContext {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  capabilityId: string | null;
  processId: string | null;
  orgUnitId: string | null;
  applicationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrgUnitAppMatrix {
  orgUnits: { id: string; name: string }[];
  applications: { id: string; name: string }[];
  usage: Record<string, Record<string, "primary_user" | "secondary_user" | "not_used">>;
}

export interface ItComponentDiagramNode {
  id: string;
  name: string;
  type: string;
  children: ItComponentDiagramNode[];
  relationshipType?: string;
}

export interface DataObjectDiagramNode {
  id: string;
  name: string;
  children: DataObjectDiagramNode[];
  crudApps?: CrudMatrixCell[];
}
