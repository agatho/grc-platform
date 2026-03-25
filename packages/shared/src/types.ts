// Shared TypeScript types (Sprint 1)
export type OrgType = "subsidiary" | "holding" | "joint_venture" | "branch";
export type UserRole = "admin" | "risk_manager" | "control_owner" | "auditor" | "dpo" | "viewer" | "process_owner";
export type LineOfDefense = "first" | "second" | "third";

export interface Organization {
  id: string;
  name: string;
  shortName?: string;
  type: OrgType;
  country: string;
  isEu: boolean;
  parentOrgId?: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: { orgId: string; role: UserRole; lineOfDefense?: LineOfDefense }[];
}

export type TaskStatus = "open" | "in_progress" | "done" | "overdue" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdAt: string;
}

// Sprint 1.4: Asset & Work Item types
export type AssetTier = "business_structure" | "primary_asset" | "supporting_asset";

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

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  lineOfDefense?: LineOfDefense;
  token: string;
  status: InvitationStatus;
  invitedBy?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}
