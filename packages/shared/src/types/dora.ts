// Sprint 72: DORA Compliance Module Types

export type DoraIctAssetType =
  | "network"
  | "hardware"
  | "software"
  | "data"
  | "cloud_service"
  | "third_party";
export type DoraThreatCategory =
  | "cyber_attack"
  | "system_failure"
  | "human_error"
  | "natural_disaster"
  | "third_party_failure";
export type DoraLikelihood =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";
export type DoraImpact = "very_low" | "low" | "medium" | "high" | "very_high";
export type DoraRiskLevel = "low" | "medium" | "high" | "critical";
export type DoraTreatmentStrategy =
  | "mitigate"
  | "accept"
  | "transfer"
  | "avoid";
export type DoraIctRiskStatus =
  | "identified"
  | "assessed"
  | "treated"
  | "accepted"
  | "closed";
export type DoraTlptTestType =
  | "red_team"
  | "purple_team"
  | "scenario_based"
  | "full_tlpt";
export type DoraTlptStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "remediation";
export type DoraIncidentType =
  | "cyber_attack"
  | "system_outage"
  | "data_breach"
  | "third_party_failure"
  | "operational_disruption";
export type DoraIncidentClassification = "major" | "significant" | "minor";
export type DoraIncidentStatus =
  | "detected"
  | "investigating"
  | "contained"
  | "resolved"
  | "closed";
export type DoraProviderServiceType =
  | "cloud"
  | "software"
  | "infrastructure"
  | "network"
  | "data_processing"
  | "consulting";
export type DoraProviderCriticality = "critical" | "important" | "standard";
export type DoraComplianceStatus =
  | "compliant"
  | "partially_compliant"
  | "non_compliant"
  | "pending"
  | "not_assessed";
export type DoraProviderStatus =
  | "active"
  | "under_review"
  | "terminated"
  | "pending";
export type DoraSharingType =
  | "threat_intelligence"
  | "vulnerability"
  | "incident_info"
  | "best_practice";
export type DoraTlpClassification =
  | "tlp_white"
  | "tlp_green"
  | "tlp_amber"
  | "tlp_red";
export type DoraSharingStatus = "draft" | "approved" | "shared" | "revoked";
export type DoraOverlapType =
  | "full_overlap"
  | "partial_overlap"
  | "dora_only"
  | "nis2_only";

export interface DoraIctRisk {
  id: string;
  orgId: string;
  riskCode: string;
  title: string;
  description?: string;
  doraArticleRef?: string;
  ictAssetType: DoraIctAssetType;
  threatCategory?: DoraThreatCategory;
  vulnerabilityDescription?: string;
  likelihood: DoraLikelihood;
  impact: DoraImpact;
  riskLevel: DoraRiskLevel;
  residualRiskLevel?: DoraRiskLevel;
  treatmentStrategy?: DoraTreatmentStrategy;
  treatmentPlan?: string;
  existingControls: DoraExistingControl[];
  affectedServices: DoraAffectedService[];
  ownerId?: string;
  reviewDate?: string;
  status: DoraIctRiskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DoraExistingControl {
  controlId: string;
  controlName: string;
  effectiveness: string;
}

export interface DoraAffectedService {
  serviceId: string;
  serviceName: string;
  criticality: string;
}

export interface DoraTlptPlan {
  id: string;
  orgId: string;
  planCode: string;
  title: string;
  description?: string;
  testType: DoraTlptTestType;
  scope?: string;
  targetSystems: DoraTlptTargetSystem[];
  threatScenarios: DoraTlptScenario[];
  testProvider?: string;
  leaderId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  findings: DoraTlptFinding[];
  findingsSummary?: string;
  remediationDeadline?: string;
  status: DoraTlptStatus;
  regulatoryNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoraTlptTargetSystem {
  systemId: string;
  systemName: string;
  criticality: string;
}

export interface DoraTlptScenario {
  scenario: string;
  threatActor: string;
  technique: string;
}

export interface DoraTlptFinding {
  severity: string;
  description: string;
  recommendation: string;
}

export interface DoraIctIncident {
  id: string;
  orgId: string;
  incidentCode: string;
  title: string;
  description: string;
  incidentType: DoraIncidentType;
  classification: DoraIncidentClassification;
  affectedServices: Record<string, unknown>[];
  affectedClients: number;
  financialImpact?: number;
  geographicScope?: string[];
  rootCause?: string;
  detectedAt: string;
  resolvedAt?: string;
  initialReportDue?: string;
  initialReportSent?: string;
  intermediateReportDue?: string;
  intermediateReportSent?: string;
  finalReportDue?: string;
  finalReportSent?: string;
  reportingAuthority?: string;
  remediationActions: DoraRemediationAction[];
  lessonsLearned?: string;
  handlerId?: string;
  status: DoraIncidentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DoraRemediationAction {
  action: string;
  assignee: string;
  deadline: string;
  status: string;
}

export interface DoraIctProvider {
  id: string;
  orgId: string;
  providerCode: string;
  name: string;
  legalEntity?: string;
  jurisdiction?: string;
  serviceDescription?: string;
  serviceType: DoraProviderServiceType;
  criticality: DoraProviderCriticality;
  contractRef?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  dataProcessed: Record<string, unknown>[];
  subcontractors: Record<string, unknown>[];
  exitStrategy?: string;
  riskAssessment: Record<string, unknown>;
  lastAuditDate?: string;
  nextAuditDate?: string;
  complianceStatus: DoraComplianceStatus;
  ownerId?: string;
  status: DoraProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DoraInformationSharing {
  id: string;
  orgId: string;
  title: string;
  sharingType: DoraSharingType;
  content: string;
  classification: DoraTlpClassification;
  recipientGroups: Record<string, unknown>[];
  sourceIncidentId?: string;
  sharedAt?: string;
  sharedBy?: string;
  anonymized: boolean;
  status: DoraSharingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DoraNis2CrossRef {
  id: string;
  orgId: string;
  doraArticle: string;
  doraRequirement: string;
  nis2Article?: string;
  nis2Requirement?: string;
  overlapType: DoraOverlapType;
  complianceStatus: DoraComplianceStatus;
  notes?: string;
  assessedBy?: string;
  assessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoraDashboard {
  totalIctRisks: number;
  criticalRisks: number;
  openIncidents: number;
  majorIncidents: number;
  totalProviders: number;
  criticalProviders: number;
  pendingReports: number;
  upcomingTlptTests: DoraTlptPlan[];
  recentIncidents: DoraIctIncident[];
  nis2ComplianceRate: number;
}
