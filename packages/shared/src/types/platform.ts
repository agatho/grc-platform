// Platform core types (Sprint 1)
export type OrgType = "subsidiary" | "holding" | "joint_venture" | "branch";
export type UserRole = "admin" | "risk_manager" | "control_owner" | "auditor" | "dpo" | "viewer" | "process_owner" | "ombudsperson" | "esg_manager" | "esg_contributor";
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
