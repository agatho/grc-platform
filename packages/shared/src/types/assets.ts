// Asset & Work Item types (Sprint 1.4)
export type AssetTier =
  | "business_structure"
  | "primary_asset"
  | "supporting_asset";

export type WorkItemStatus =
  | "draft"
  | "in_evaluation"
  | "in_review"
  | "in_approval"
  | "management_approved"
  | "active"
  | "in_treatment"
  | "completed"
  | "obsolete"
  | "cancelled";

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  assetTier: AssetTier;
  codeGroup?: string;
  defaultConfidentiality?: number;
  defaultIntegrity?: number;
  defaultAvailability?: number;
  defaultAuthenticity?: number;
  defaultReliability?: number;
  protectionGoalClass?: number;
  contactPerson?: string;
  dataProtectionResponsible?: string;
  dpoEmail?: string;
  latestAuditDate?: string;
  latestAuditResult?: string;
  parentAssetId?: string;
  visibleInModules: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface AssetCiaProfile {
  id: string;
  assetId: string;
  orgId: string;
  assessmentRunId?: string;
  confidentiality: number;
  integrity: number;
  availability: number;
  authenticity?: number;
  reliability?: number;
  protectionGoalClass?: number;
  isAssessmentRequired: boolean;
  overruleJustification?: string;
  validFrom: string;
  validTo?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface WorkItem {
  id: string;
  orgId: string;
  typeKey: string;
  elementId?: string;
  name: string;
  status: WorkItemStatus;
  responsibleId?: string;
  reviewerId?: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  grcPerspective: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface WorkItemType {
  typeKey: string;
  displayNameDe: string;
  displayNameEn: string;
  icon?: string;
  colorClass?: string;
  primaryModule: string;
  secondaryModules: string[];
  hasStatusWorkflow: boolean;
  hasResponsibleUser: boolean;
  hasDueDate: boolean;
  hasPriority: boolean;
  hasLinkedAsset: boolean;
  hasCiaEvaluation: boolean;
  isCrossModule: boolean;
  elementIdPrefix?: string;
  navOrder: number;
  isActiveInPlatform: boolean;
}

export interface WorkItemLink {
  id: string;
  orgId: string;
  sourceId: string;
  targetId: string;
  linkType: string;
  linkContext?: string;
  createdAt: string;
  createdBy?: string;
}
