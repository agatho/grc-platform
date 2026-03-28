// Sprint 62: Evidence Connector Framework types

export type ConnectorType =
  | "aws"
  | "azure"
  | "gcp"
  | "entra_id"
  | "google_workspace"
  | "m365"
  | "git_platform"
  | "issue_tracker"
  | "endpoint_mgmt"
  | "network_firewall"
  | "wiki"
  | "hr_system"
  | "custom_api"
  | "file_import";

export type ConnectorStatus = "inactive" | "active" | "error" | "disabled" | "pending_setup";

export type ConnectorAuthMethod = "oauth2" | "api_key" | "service_account" | "certificate" | "basic_auth";

export type ConnectorHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export type CredentialType = "oauth2_token" | "api_key" | "service_account_json" | "client_certificate" | "basic_credentials";

export type ArtifactType = "screenshot" | "json_export" | "csv_export" | "pdf_report" | "log_extract" | "config_snapshot" | "api_response";

export type TestResultStatus = "pass" | "fail" | "error" | "skipped" | "warning";

export type TestSeverity = "critical" | "high" | "medium" | "low" | "informational";

export type TestCategory =
  | "iam"
  | "encryption"
  | "logging"
  | "network"
  | "data_protection"
  | "access_control"
  | "configuration"
  | "monitoring";

export type ScheduleRunStatus = "success" | "partial_failure" | "failure";

export type HealthCheckType = "connectivity" | "authentication" | "authorization" | "data_access";

export interface FrameworkMappingRef {
  framework: string;
  controlId: string;
}

export interface EvidenceConnector {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  connectorType: ConnectorType;
  providerKey: string;
  version: string;
  status: ConnectorStatus;
  authMethod: ConnectorAuthMethod;
  baseUrl?: string | null;
  config: Record<string, unknown>;
  capabilities: string[];
  lastHealthCheck?: string | null;
  healthStatus: ConnectorHealthStatus;
  errorMessage?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorCredential {
  id: string;
  orgId: string;
  connectorId: string;
  credentialType: CredentialType;
  expiresAt?: string | null;
  scopes: string[];
  lastRotatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorSchedule {
  id: string;
  orgId: string;
  connectorId: string;
  cronExpression: string;
  timezone: string;
  isEnabled: boolean;
  testIds: string[];
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastRunStatus?: ScheduleRunStatus | null;
  lastRunDurationMs?: number | null;
  consecutiveFailures: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceArtifact {
  id: string;
  orgId: string;
  connectorId: string;
  testResultId?: string | null;
  artifactType: ArtifactType;
  fileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  checksumSha256: string;
  metadata: Record<string, unknown>;
  retentionDays: number;
  expiresAt?: string | null;
  collectedAt: string;
  createdAt: string;
}

export interface ConnectorHealthCheck {
  id: string;
  orgId: string;
  connectorId: string;
  status: ConnectorHealthStatus;
  responseTimeMs?: number | null;
  checkType: HealthCheckType;
  errorMessage?: string | null;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface ConnectorTestDefinition {
  id: string;
  testKey: string;
  connectorType: ConnectorType;
  providerKey: string;
  name: string;
  description?: string | null;
  category: TestCategory;
  severity: TestSeverity;
  frameworkMappings: FrameworkMappingRef[];
  testLogic: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  remediationGuide?: string | null;
  isBuiltIn: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorTestResult {
  id: string;
  orgId: string;
  connectorId: string;
  testDefinitionId: string;
  scheduleId?: string | null;
  status: TestResultStatus;
  result: Record<string, unknown>;
  findings: TestFinding[];
  resourcesScanned: number;
  resourcesFailed: number;
  durationMs?: number | null;
  artifactIds: string[];
  errorMessage?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface TestFinding {
  severity: TestSeverity;
  message: string;
  resource?: string;
}

export interface EvidenceFreshnessConfig {
  id: string;
  orgId: string;
  entityType: string;
  entityId?: string | null;
  connectorId?: string | null;
  testKey?: string | null;
  maxAgeDays: number;
  warningDays: number;
  autoCollect: boolean;
  notifyOnStale: boolean;
  notifyRoles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorDashboardStats {
  totalConnectors: number;
  activeConnectors: number;
  healthyConnectors: number;
  degradedConnectors: number;
  unhealthyConnectors: number;
  totalTestsRun24h: number;
  passRate24h: number;
  totalArtifacts: number;
  staleEvidence: number;
}
