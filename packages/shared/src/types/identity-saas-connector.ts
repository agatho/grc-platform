// Sprint 64: Identity und SaaS Connectors types

export type SaasIdentityProvider =
  | "entra_id"
  | "google_workspace"
  | "okta"
  | "generic_oidc"
  | "hr_system";

export type IdentityTestCategory =
  | "mfa_enforcement"
  | "stale_accounts"
  | "password_policy"
  | "access_review"
  | "privileged_accounts"
  | "guest_access"
  | "conditional_access"
  | "dlp"
  | "retention"
  | "onboarding"
  | "offboarding";

export type SaasPlatform = "m365" | "google_workspace" | "hr_system";

export type SaasCheckType =
  | "dlp_policy"
  | "retention_policy"
  | "sharing_policy"
  | "external_sharing"
  | "mailbox_audit"
  | "drive_sharing"
  | "onboarding_sla"
  | "offboarding_sla";

export type SaasComplianceStatus =
  | "compliant"
  | "non_compliant"
  | "partial"
  | "error"
  | "not_applicable";

export type SyncInterval = "hourly" | "daily" | "weekly";

export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface IdentityConnectorConfig {
  id: string;
  orgId: string;
  connectorId: string;
  identityProvider: SaasIdentityProvider;
  tenantId?: string | null;
  domain?: string | null;
  syncEnabled: boolean;
  syncInterval: SyncInterval;
  mfaCheckEnabled: boolean;
  staleAccountDays: number;
  passwordPolicyCheck: boolean;
  accessReviewEnabled: boolean;
  privilegedAccountMonitoring: boolean;
  guestAccessCheck: boolean;
  conditionalAccessCheck: boolean;
  dlpEnabled: boolean;
  retentionPolicyCheck: boolean;
  onboardingCheck: boolean;
  offboardingCheck: boolean;
  lastSyncAt?: string | null;
  syncStatus: SyncStatus;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityTestResult {
  id: string;
  orgId: string;
  connectorId: string;
  configId: string;
  testCategory: IdentityTestCategory;
  testName: string;
  status: string;
  severity: string;
  totalUsers: number;
  compliantUsers: number;
  nonCompliantUsers: number;
  complianceRate?: number | null;
  findings: IdentityFinding[];
  evidence: Record<string, unknown>;
  remediationSteps?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface IdentityFinding {
  userId?: string;
  userName?: string;
  issue: string;
  severity: string;
}

export interface SaasComplianceCheck {
  id: string;
  orgId: string;
  connectorId: string;
  platform: SaasPlatform;
  checkType: SaasCheckType;
  checkName: string;
  status: SaasComplianceStatus;
  severity: string;
  details: Record<string, unknown>;
  findings: Array<Record<string, unknown>>;
  affectedResources: number;
  totalResources: number;
  complianceRate?: number | null;
  remediationGuide?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface IdentityDashboardStats {
  totalUsers: number;
  mfaComplianceRate: number;
  staleAccounts: number;
  privilegedAccounts: number;
  pendingAccessReviews: number;
  saasComplianceRate: number;
}
