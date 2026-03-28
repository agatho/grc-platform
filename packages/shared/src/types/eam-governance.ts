// Sprint 53: EAM Governance & Deep Integration types

export type GovernanceStatus = "draft" | "pending_review" | "approved" | "published" | "rejected" | "archived";
export type GovernanceAction = "publish" | "approve" | "reject" | "archive" | "change_to_suggestion";
export type GovernanceRole = "author" | "examiner" | "responsible";
export type BpmnPlacementType = "application" | "it_component" | "data_object";
export type BiExportFormat = "json" | "csv";

export const GOVERNANCE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: ["published"],
  published: ["archived", "draft"],
  rejected: ["draft"],
  archived: [],
};

export interface GovernanceLogEntry {
  id: string;
  orgId: string;
  elementId: string;
  elementType: string;
  fromStatus: string | null;
  toStatus: string;
  action: GovernanceAction;
  performedBy: string;
  justification: string | null;
  performedAt: string;
}

export interface GovernanceTransitionRequest {
  action: GovernanceAction;
  justification?: string;
}

export interface BulkGovernanceRequest {
  elementIds: string[];
  action: GovernanceAction;
  justification?: string;
}

export interface GovernanceRoleAssignment {
  elementId: string;
  examinerId?: string;
  responsibleId?: string;
}

export interface BpmnElementPlacement {
  id: string;
  processVersionId: string;
  eamElementId: string;
  orgId: string;
  placementType: BpmnPlacementType;
  bpmnNodeId: string | null;
  positionX: number | null;
  positionY: number | null;
  createdAt: string;
}

export interface BpmnEamShape {
  type: string;
  shape: string;
  icon: string;
  label: string;
  badges: BpmnBadge[];
}

export interface BpmnBadge {
  type: "lifecycle" | "risk" | "cve" | "compliance";
  value: string;
  color?: string;
}

export interface ProcessEamMatrix {
  activities: { id: string; name: string }[];
  eamObjects: { id: string; name: string; type: BpmnPlacementType }[];
  mappings: Record<string, string[]>;
}

export interface BiExportQuery {
  $filter?: string;
  $select?: string;
  $top?: number;
  $skip?: number;
  $orderby?: string;
}

export interface BiExportResult {
  value: Record<string, unknown>[];
  count: number;
  nextLink?: string;
}

export interface ExcelImportPreview {
  newObjects: ImportPreviewRow[];
  updatedObjects: ImportPreviewRow[];
  unchangedCount: number;
  ambiguousMatches: ImportPreviewRow[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  matchedId?: string;
  matchedName?: string;
  changes?: Record<string, { old: string; new: string }>;
}

export interface ApplicationDetailAccordion {
  generalInfo: boolean;
  eamAttributes: boolean;
  relations: boolean;
  lifecycle: boolean;
  itManagement: boolean;
  protectionRequirement: boolean;
  personalDataProcessing: boolean;
  systemAttributes: boolean;
}

export interface ProtectionRequirementDisplay {
  confidentiality: number | null;
  integrity: number | null;
  availability: number | null;
  authenticity: number | null;
  reliability: number | null;
  overallLevel: string | null;
}

export interface OccurrenceEntry {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  link: string;
}

export interface PredecessorInfo {
  predecessorId: string | null;
  predecessorName: string | null;
  successorId: string | null;
  successorName: string | null;
}

export interface LifecycleBarData {
  phases: LifecycleBarPhase[];
  currentDate: string;
}

export interface LifecycleBarPhase {
  phase: string;
  startDate: string | null;
  endDate: string | null;
  color: string;
}
