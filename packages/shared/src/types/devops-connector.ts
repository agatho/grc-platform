// Sprint 65: DevOps und IT Connectors types

export type DevopsPlatform = "github" | "gitlab" | "bitbucket" | "jira" | "confluence" | "servicenow" | "wiki_generic";

export type DevopsPlatformCategory = "git_platform" | "issue_tracker" | "wiki" | "endpoint_mgmt" | "network_firewall";

export type DevopsTestCategory =
  | "branch_protection"
  | "code_review"
  | "sast"
  | "secret_scanning"
  | "sla_compliance"
  | "docs_freshness"
  | "endpoint_compliance"
  | "firewall_rules";

export type DevopsResourceType = "repository" | "project" | "space" | "endpoint" | "firewall";

export type ItCheckType =
  | "endpoint_encryption"
  | "endpoint_patching"
  | "endpoint_antivirus"
  | "firewall_rule_review"
  | "network_segmentation"
  | "vpn_config"
  | "certificate_expiry";

export type ItResourceType = "endpoint" | "firewall" | "switch" | "router" | "certificate" | "vpn";

export type InfraComplianceStatus = "compliant" | "non_compliant" | "warning" | "error";

export interface DevopsConnectorConfig {
  id: string;
  orgId: string;
  connectorId: string;
  platform: DevopsPlatform;
  platformCategory: DevopsPlatformCategory;
  branchProtectionCheck: boolean;
  codeReviewCheck: boolean;
  sastEnabled: boolean;
  secretScanningCheck: boolean;
  slaComplianceCheck: boolean;
  docsFreshnessCheck: boolean;
  docsFreshnessMaxDays: number;
  endpointComplianceCheck: boolean;
  firewallRuleCheck: boolean;
  repositories: string[];
  projects: string[];
  spaces: string[];
  config: Record<string, unknown>;
  lastSyncAt?: string | null;
  syncStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevopsTestResult {
  id: string;
  orgId: string;
  connectorId: string;
  configId: string;
  testCategory: DevopsTestCategory;
  testName: string;
  resourceType: DevopsResourceType;
  resourceName: string;
  status: string;
  severity: string;
  details: Record<string, unknown>;
  findings: Array<Record<string, unknown>>;
  metrics: Record<string, unknown>;
  complianceRate?: number | null;
  remediationSteps?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface ItInfrastructureCheck {
  id: string;
  orgId: string;
  connectorId: string;
  checkType: ItCheckType;
  checkName: string;
  resourceType: ItResourceType;
  status: InfraComplianceStatus;
  severity: string;
  totalDevices: number;
  compliantDevices: number;
  nonCompliantDevices: number;
  complianceRate?: number | null;
  findings: Array<Record<string, unknown>>;
  details: Record<string, unknown>;
  remediationGuide?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface DevopsDashboardStats {
  repositoriesMonitored: number;
  branchProtectionRate: number;
  codeReviewCoverage: number;
  secretScanningEnabled: number;
  endpointComplianceRate: number;
  firewallRuleCompliance: number;
  criticalFindings: number;
}
