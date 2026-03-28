// Sprint 37: EAM Advanced types

export type TransferMechanism = "api" | "file_transfer" | "message_queue" | "database_replication" | "manual";
export type EncryptionType = "tls" | "vpn" | "none";
export type EncryptionAtRest = "aes256" | "none";
export type DataFlowFrequency = "real_time" | "hourly" | "daily" | "weekly" | "monthly" | "on_demand";
export type DataFlowStatus = "active" | "planned" | "deprecated";
export type LegalBasis = "consent" | "contract" | "legitimate_interest" | "legal_obligation";
export type SchremsIiSafeguard = "adequacy_decision" | "scc" | "bcr" | "none";
export type InterfaceType = "rest_api" | "soap" | "graphql" | "grpc" | "file_transfer" | "message_queue" | "database_link" | "manual";
export type InterfaceDirection = "provides" | "consumes";
export type HealthStatus = "active" | "degraded" | "down" | "unknown";
export type TechCategory = "language" | "framework" | "database" | "cloud_service" | "infrastructure" | "tool" | "platform";
export type TechQuadrant = "languages_frameworks" | "infrastructure" | "data_management" | "tools";
export type TechRing = "adopt" | "trial" | "assess" | "hold";
export type AcrChangeType = "add_element" | "remove_element" | "modify_element" | "add_relationship" | "migration";
export type AcrStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "deferred";
export type AcrRiskAssessment = "low" | "medium" | "high" | "critical";
export type VoteChoice = "approve" | "reject" | "defer" | "abstain";
export type CloudProvider = "aws" | "azure" | "gcp";

export interface DataFlow {
  id: string;
  orgId: string;
  sourceElementId: string;
  targetElementId: string;
  name: string;
  description?: string;
  dataCategories: string[];
  containsPersonalData: boolean;
  transferMechanism: TransferMechanism;
  encryptionInTransit?: EncryptionType;
  encryptionAtRest?: EncryptionAtRest;
  frequency: DataFlowFrequency;
  volumePerDay?: string;
  hostingSource?: string;
  hostingTarget?: string;
  crossesEuBorder: boolean;
  legalBasis?: LegalBasis;
  schremsIiSafeguard?: SchremsIiSafeguard;
  ropaEntryId?: string;
  status: DataFlowStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInterface {
  id: string;
  orgId: string;
  elementId: string;
  name: string;
  description?: string;
  interfaceType: InterfaceType;
  direction: InterfaceDirection;
  protocol?: string;
  authentication?: string;
  dataFormat?: string;
  slaAvailability?: number;
  documentationUrl?: string;
  healthCheckUrl?: string;
  healthStatus: HealthStatus;
  lastHealthCheck?: string;
  createdAt: string;
}

export interface TechnologyEntry {
  id: string;
  orgId: string;
  name: string;
  category: TechCategory;
  quadrant: TechQuadrant;
  ring: TechRing;
  versionInUse?: string;
  latestVersion?: string;
  vendor?: string;
  description?: string;
  rationale?: string;
  movedFrom?: TechRing;
  movedAt?: string;
  websiteUrl?: string;
  applicationsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TechnologyApplicationLink {
  id: string;
  technologyId: string;
  elementId: string;
  orgId: string;
  versionUsed?: string;
  notes?: string;
}

export interface ArchitectureChangeRequest {
  id: string;
  orgId: string;
  title: string;
  description: string;
  justification?: string;
  changeType: AcrChangeType;
  affectedElementIds: string[];
  riskAssessment: AcrRiskAssessment;
  costEstimate?: number;
  status: AcrStatus;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionRationale?: string;
  conditions?: string;
  implementationDeadline?: string;
  impactSummary?: AcrImpactSummary;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcrImpactSummary {
  affectedProcesses?: string[];
  affectedControls?: string[];
  affectedDataFlows?: string[];
  complianceImplications?: string[];
  spofChange?: string;
  healthScoreDelta?: number;
}

export interface ArchitectureChangeVote {
  id: string;
  changeRequestId: string;
  userId: string;
  vote: VoteChoice;
  comment?: string;
  votedAt: string;
}

export interface ArchitectureHealthSnapshot {
  id: string;
  orgId: string;
  overallScore: number;
  portfolioAgeScore?: number;
  technologyCurrencyScore?: number;
  integrationComplexityScore?: number;
  spofCount?: number;
  ruleViolations?: number;
  dataFlowComplianceScore?: number;
  technicalDebtEur?: number;
  factorBreakdown?: Record<string, unknown>;
  snapshotAt: string;
}

export interface CloudServiceCatalogEntry {
  id: string;
  provider: CloudProvider;
  serviceName: string;
  category: string;
  description?: string;
  architectureType: string;
  regionAvailability?: string[];
}

export interface CrossBorderResult {
  crossesEuBorder: boolean;
  requiresSafeguard: boolean;
  hasAdequacy: boolean;
}

export interface ArchHealthScore {
  overall: number;
  portfolioAge: number;
  techCurrency: number;
  integrationComplexity: number;
  spofScore: number;
  ruleCompliance: number;
  dataFlowCompliance: number;
}

export interface TechnicalDebt {
  totalEur: number;
  eolApplications: { elementId: string; name: string; cost: number }[];
  unsupportedTech: { technologyId: string; name: string; cost: number }[];
}

export interface RedundancyCluster {
  clusterId: string;
  applications: { id: string; name: string; annualCost: number }[];
  overlapScore: number;
  sharedCapabilities: string[];
  estimatedSavings: number;
}

export const EU_EEA_COUNTRIES = [
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO",
] as const;

export const ADEQUACY_COUNTRIES = [
  "AD","AR","CA","FO","GG","IL","IM","JP","JE","NZ","KR","CH","UY","UK","US",
] as const;

export const ACR_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["under_review"],
  under_review: ["approved", "rejected", "deferred"],
  approved: [],
  rejected: [],
  deferred: ["submitted"],
};
