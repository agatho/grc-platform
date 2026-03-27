// Business Continuity Management System (BCMS) types (Sprint 6)
export type BiaStatus = "draft" | "in_progress" | "review" | "approved" | "archived";
export type BcpStatus = "draft" | "in_review" | "approved" | "published" | "archived" | "superseded";
export type CrisisSeverity = "level_1_incident" | "level_2_emergency" | "level_3_crisis" | "level_4_catastrophe";
export type CrisisStatus = "standby" | "activated" | "resolved" | "post_mortem";
export type ExerciseType = "tabletop" | "walkthrough" | "functional" | "full_simulation";
export type ExerciseStatus = "planned" | "preparation" | "executing" | "evaluation" | "completed" | "cancelled";
export type StrategyType = "active_active" | "active_passive" | "cold_standby" | "manual_workaround" | "outsource" | "do_nothing";
export type BcpResourceType = "people" | "it_system" | "facility" | "supplier" | "equipment" | "data" | "other";
export type ExerciseResult = "successful" | "partially_successful" | "failed";
export type CrisisLogEntryType = "decision" | "communication" | "action" | "status_change" | "observation";
export type ExerciseFindingSeverity = "critical" | "major" | "minor" | "observation";

export interface BiaAssessment {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: BiaStatus;
  periodStart?: string;
  periodEnd?: string;
  leadAssessorId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BiaProcessImpact {
  id: string;
  orgId: string;
  biaAssessmentId: string;
  processId: string;
  mtpdHours?: number;
  rtoHours?: number;
  rpoHours?: number;
  impact1h?: string;
  impact4h?: string;
  impact24h?: string;
  impact72h?: string;
  impact1w?: string;
  impact1m?: string;
  impactReputation?: number;
  impactLegal?: number;
  impactOperational?: number;
  impactFinancial?: number;
  impactSafety?: number;
  criticalResources?: string;
  minimumStaff?: number;
  alternateLocation?: string;
  peakPeriods?: string;
  dependenciesJson?: unknown;
  priorityRanking?: number;
  isEssential: boolean;
  assessedBy?: string;
  assessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BiaSupplierDependency {
  id: string;
  biaProcessImpactId: string;
  orgId: string;
  supplierName: string;
  vendorId?: string;
  service?: string;
  isCritical: boolean;
  alternativeAvailable: boolean;
  switchoverTimeHours?: number;
  notes?: string;
  createdAt: string;
}

export interface EssentialProcess {
  id: string;
  orgId: string;
  processId: string;
  biaAssessmentId?: string;
  priorityRanking: number;
  mtpdHours: number;
  rtoHours: number;
  justification?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bcp {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  status: BcpStatus;
  version: number;
  scope?: string;
  processIds: string[];
  bcManagerId?: string;
  deputyManagerId?: string;
  activationCriteria?: string;
  activationAuthority?: string;
  reportDocumentId?: string;
  lastTestedDate?: string;
  nextReviewDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface BcpProcedure {
  id: string;
  bcpId: string;
  orgId: string;
  stepNumber: number;
  title: string;
  description?: string;
  responsibleRole?: string;
  responsibleId?: string;
  estimatedDurationMinutes?: number;
  requiredResources?: string;
  prerequisites?: string;
  successCriteria?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BcpResource {
  id: string;
  bcpId: string;
  orgId: string;
  resourceType: BcpResourceType;
  name: string;
  description?: string;
  quantity: number;
  assetId?: string;
  isAvailableOffsite: boolean;
  alternativeResource?: string;
  priority: string;
  createdAt: string;
}

export interface ContinuityStrategy {
  id: string;
  orgId: string;
  processId: string;
  strategyType: StrategyType;
  name: string;
  description?: string;
  rtoTargetHours: number;
  rtoActualHours?: number;
  estimatedCostEur?: string;
  annualCostEur?: string;
  requiredStaff?: number;
  requiredSystems?: string;
  alternateLocation?: string;
  isActive: boolean;
  lastTestedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CrisisScenario {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  category: string;
  severity: CrisisSeverity;
  status: CrisisStatus;
  escalationMatrix: unknown;
  communicationTemplate?: string;
  bcpId?: string;
  activatedAt?: string;
  activatedBy?: string;
  resolvedAt?: string;
  postMortemNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CrisisTeamMember {
  id: string;
  crisisScenarioId: string;
  orgId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  deputyUserId?: string;
  phoneNumber?: string;
  createdAt: string;
}

export interface CrisisLog {
  id: string;
  crisisScenarioId: string;
  orgId: string;
  timestamp: string;
  entryType: CrisisLogEntryType;
  title: string;
  description?: string;
  createdBy?: string;
}

export interface BcExercise {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  exerciseType: ExerciseType;
  status: ExerciseStatus;
  crisisScenarioId?: string;
  bcpId?: string;
  plannedDate: string;
  plannedDurationHours?: number;
  actualDate?: string;
  actualDurationHours?: number;
  exerciseLeadId?: string;
  participantIds: string[];
  observerIds: string[];
  objectives: unknown;
  lessonsLearned?: string;
  overallResult?: ExerciseResult;
  reportDocumentId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BcExerciseFinding {
  id: string;
  exerciseId: string;
  orgId: string;
  findingId?: string;
  title: string;
  description?: string;
  severity: ExerciseFindingSeverity;
  recommendation?: string;
  createdAt: string;
  createdBy?: string;
}

export interface BcmsDashboard {
  essentialProcessCount: number;
  biaCompletionPct: number;
  activeBcpCount: number;
  bcpCoveragePct: number;
  crisisScenarioCount: number;
  activeCrisisCount: number;
  exercisesCompleted: number;
  exercisesPlanned: number;
  openExerciseFindings: number;
  avgRtoHours: number | null;
}
