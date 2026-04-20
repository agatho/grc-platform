// Sprint 38: Platform Advanced Types

export interface CustomFieldDefinition {
  id: string;
  orgId: string;
  entityType: string;
  fieldKey: string;
  label: Record<string, string>;
  fieldType: string;
  options: Array<{ value: string; label: Record<string, string> }>;
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    regex?: string;
  };
  defaultValue: unknown;
  placeholder?: Record<string, string>;
  helpText?: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  showInList: boolean;
  showInExport: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: string;
  channel: "in_app" | "email" | "both" | "digest" | "none";
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestFrequency?: "daily" | "weekly";
}

export interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content?: string;
  module?: string;
  status?: string;
  updatedAt: string;
}

export interface SearchFacets {
  byType: Record<string, number>;
  byModule: Record<string, number>;
  total: number;
}

export interface OrgHierarchyNode {
  id: string;
  name: string;
  parentOrgId: string | null;
  hierarchyLevel: number;
  children: OrgHierarchyNode[];
}

export interface OrgHierarchyRollup {
  orgId: string;
  orgName: string;
  riskCount: number;
  incidentCount: number;
  avgCes: number;
  complianceScore: number;
}

export interface CustomFieldValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
