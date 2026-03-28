// Sprint 41: BCMS Advanced Types

export interface CrisisContactTree {
  id: string;
  orgId: string;
  name: string;
  crisisType: string;
  isActive: boolean;
  lastReviewedAt?: string;
  reviewCycleMonths: number;
  nodes: CrisisContactNode[];
}

export interface CrisisContactNode {
  id: string;
  treeId: string;
  parentNodeId?: string;
  sortOrder: number;
  userId?: string;
  roleTitle: string;
  name?: string;
  phone?: string;
  email?: string;
  escalationMinutes: number;
  deputyUserId?: string;
  deputyName?: string;
  children?: CrisisContactNode[];
}

export interface CrisisCommunicationLogEntry {
  id: string;
  crisisId: string;
  nodeId?: string;
  channel: "email" | "sms" | "in_app" | "phone";
  messageContent: string;
  recipientName?: string;
  recipientContact?: string;
  sentAt: string;
  acknowledgedAt?: string;
  escalatedAt?: string;
  status: "sent" | "delivered" | "acknowledged" | "escalated" | "failed";
}

export interface BCExercise {
  id: string;
  orgId: string;
  title: string;
  exerciseType: "tabletop" | "walkthrough" | "functional" | "full_scale";
  scenarioId?: string;
  scheduledDate: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  objectives: Array<{ objective: string; successCriteria: string; achieved?: boolean }>;
  overallScore?: number;
  actualStart?: string;
  actualEnd?: string;
}

export interface BCExerciseScenario {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  crisisType: string;
  durationHours: number;
  difficulty: "basic" | "intermediate" | "advanced";
  injects: BCExerciseInject[];
}

export interface BCExerciseInject {
  timeOffsetMinutes: number;
  title: string;
  description: string;
  expectedResponse: string;
  evaluationCriteria: string;
}

export interface BCExerciseInjectLog {
  id: string;
  exerciseId: string;
  injectIndex: number;
  triggeredAt: string;
  teamResponse?: string;
  observerNotes?: string;
  scores?: { timeliness: number; completeness: number; communication: number; decision: number };
  respondedAt?: string;
}

export interface BCExerciseLesson {
  id: string;
  exerciseId: string;
  lesson: string;
  category?: string;
  severity?: string;
  improvementAction?: string;
  actionOwnerId?: string;
  actionDeadline?: string;
  taskId?: string;
  status: "open" | "in_progress" | "completed";
}

export interface RecoveryProcedure {
  id: string;
  orgId: string;
  title: string;
  entityType: string;
  entityId: string;
  version: number;
  status: "draft" | "reviewed" | "approved";
  reviewCycleMonths: number;
  nextReviewDate?: string;
  steps: RecoveryProcedureStep[];
}

export interface RecoveryProcedureStep {
  id: string;
  procedureId: string;
  sortOrder: number;
  title: string;
  description?: string;
  responsibleRole?: string;
  estimatedDurationMinutes?: number;
  requiredResources?: string;
  dependsOnStepId?: string;
  isCompleted: boolean;
  completedAt?: string;
  actualDurationMinutes?: number;
  executionNotes?: string;
}

export interface ResilienceScore {
  overallScore: number;
  biaCompleteness: number;
  bcpCurrency: number;
  exerciseCompletion: number;
  recoverCapability: number;
  communicationReadiness: number;
  procedureCompleteness: number;
  supplyChainResilience: number;
  snapshotAt: string;
}

export interface MtpdCascadeResult {
  processId: string;
  processName: string;
  processMtpd: number;
  applicationId: string;
  applicationName: string;
  infrastructureId: string;
  infrastructureName: string;
  infraRto: number;
  cascadedRto: number;
  mtpdBreached: boolean;
  gap: number;
}

export interface SinglePointOfFailure {
  elementId: string;
  elementName: string;
  elementType: string;
  dependentProcessCount: number;
  dependentProcesses: Array<{ id: string; name: string; criticality: string }>;
}

export interface RecoveryReadinessRow {
  processId: string;
  processName: string;
  targetMtpd: number;
  demonstratedRto?: number;
  gap: number;
  lastExerciseDate?: string;
  procedureStatus?: string;
  recoveryTeamAssigned: boolean;
}
