// Sprint 37: EAM Advanced types

export type TransferMechanism =
  "api" | "file_transfer" | "message_queue" | "database_replication" | "manual";
export type EncryptionType = "tls" | "vpn" | "none";
export type EncryptionAtRest = "aes256" | "none";
export type DataFlowFrequency =
  "real_time" | "hourly" | "daily" | "weekly" | "monthly" | "on_demand";
export type DataFlowStatus = "active" | "planned" | "deprecated";
export type LegalBasis =
  "consent" | "contract" | "legitimate_interest" | "legal_obligation";
export type SchremsIiSafeguard = "adequacy_decision" | "scc" | "bcr" | "none";
export type InterfaceType =
  | "rest_api"
  | "soap"
  | "graphql"
  | "grpc"
  | "file_transfer"
  | "message_queue"
  | "database_link"
  | "manual";
export type InterfaceDirection = "provides" | "consumes";
export type HealthStatus = "active" | "degraded" | "down" | "unknown";
export type TechCategory =
  | "language"
  | "framework"
  | "database"
  | "cloud_service"
  | "infrastructure"
  | "tool"
  | "platform";
export type TechQuadrant =
  "languages_frameworks" | "infrastructure" | "data_management" | "tools";
export type TechRing = "adopt" | "trial" | "assess" | "hold";
export type AcrChangeType =
  | "add_element"
  | "remove_element"
  | "modify_element"
  | "add_relationship"
  | "migration";
export type AcrStatus =
  "draft" | "submitted" | "under_review" | "approved" | "rejected" | "deferred";
export type AcrRiskAssessment = "low" | "medium" | "high" | "critical";
export type VoteChoice = "approve" | "reject" | "defer" | "abstain";
export type EamCloudProvider = "aws" | "azure" | "gcp";

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
  provider: EamCloudProvider;
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

// [ARCTOS-FULL-2026-08-31 · Welle 8c] Hier stand `EU_EEA_COUNTRIES` — 30
// Codes (EU-27 + IS/LI/NO), seit e40ab5a5 (Sprints 34-37), ohne einen
// einzigen Verwender im Repository.
//
// Welle 6a hat direkt darunter die zweite `ADEQUACY_COUNTRIES` entfernt und
// diese Liste stehen lassen. Die Zusicherung, die daraus entstand, zaehlt
// die Deklarationen — aber nur fuer EINEN Namen. Genau durch diese Luecke
// ist in dieser Welle beim Beheben von OP-201 eine zweite
// `EU_EEA_COUNTRIES` in `state-machines/dpms-tia.ts` entstanden: die
// EU/EWR-Liste der TPRM-Route wurde ins Paket gezogen, ohne zu pruefen, ob
// es den Namen dort schon gibt.
//
// Damit war fuer die Dauer dieser Welle derselbe Zustand hergestellt, den
// Welle 6a beseitigt hatte: der namentliche Export in `index.ts` verdeckt
// den gleichnamigen Stern-Export aus `types.ts:39`, und was aus
// `@grc/shared` herauskommt, ist nicht die Liste, die man hier liest.
// Inhaltlich waren beide deckungsgleich — der Schaden war die Verdeckung,
// nicht der Inhalt.
//
// Aufgefallen ist es nicht an einer Zusicherung, sondern an der
// Dead-Exports-Ratsche, und dort als angebliche VERBESSERUNG:
// `eam-advanced.ts: 28 < Baseline 29`. Der tote Export war nicht
// verschwunden, er war durch den Import in der TPRM-Route nur namentlich
// erreichbar geworden — der Detektor loest ueber den Namen auf und traf die
// falsche Datei. Ein Tor, das gruen meldet, was ein Defekt ist.
//
// Die eine gueltige Liste steht in `state-machines/dpms-tia.ts`, neben der
// Angemessenheitsliste: beide beantworten dieselbe Frage und muessen
// zusammen gepflegt werden. Die Zusicherung zaehlt jetzt beide Namen; siehe
// `packages/shared/tests/dpms-tia-retention.test.ts`.

// [N-2 · Welle 6a] Hier stand eine ZWEITE Liste der Angemessenheitsbeschluesse
// (`ADEQUACY_COUNTRIES`), und sie war falsch.
//
// Gemessen am 2026-09-07: derselbe Name wird von
// `src/state-machines/dpms-tia.ts:114` als `Set` exportiert und in
// `src/index.ts:259` NAMENTLICH aus dem Barrel gereicht. Ein namentlicher
// Export verdeckt den gleichnamigen Stern-Export aus `types.ts:39` — was aus
// `@grc/shared` herauskam, war also immer die andere Liste:
//
//   import { ADEQUACY_COUNTRIES } from "@grc/shared"
//   -> [object Set], enthaelt GB: true | enthaelt UK: false, Anzahl: 15
//
// Die Liste hier hatte keinen einzigen Verwender und trug fuer das
// Vereinigte Koenigreich den Code `"UK"`. Das ist kein ISO-3166-1-alpha-2-
// Code (das ist `GB`); ein Laendercode aus der Datenbank haette sie nie
// getroffen. Eine verdeckte, nie erreichte und zusaetzlich falsche Kopie
// einer rechtlich relevanten Liste ist schlimmer als keine — sie ist
// entfernt. Die eine gueltige Liste steht in `state-machines/dpms-tia.ts`.
//
// Was dabei offen bleibt und NICHT hier zu beheben ist: eine DRITTE Kopie
// liegt inline in `apps/web/src/app/api/v1/tprm/sub-processors/route.ts:90`
// und weicht ihrerseits ab — ihr fehlen die USA. Derselbe Sachverhalt
// bekommt dort also eine andere Antwort als aus `assessTransferRisk`.

export const ACR_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["under_review"],
  under_review: ["approved", "rejected", "deferred"],
  approved: [],
  rejected: [],
  deferred: ["submitted"],
};
