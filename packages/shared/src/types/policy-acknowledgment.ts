// Policy Acknowledgment Portal types (Sprint 15)

export type PolicyDistributionStatus = "draft" | "active" | "closed";
export type PolicyAcknowledgmentStatus = "pending" | "acknowledged" | "overdue" | "failed_quiz";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TargetScope {
  departments?: string[];
  roles?: string[];
  userIds?: string[];
  allUsers?: boolean;
}

export interface PolicyDistribution {
  id: string;
  orgId: string;
  documentId: string;
  documentVersion: number;
  title: string;
  targetScope: TargetScope;
  deadline: string;
  isMandatory: boolean;
  requiresQuiz: boolean;
  quizPassThreshold: number;
  quizQuestions: QuizQuestion[];
  reminderDaysBefore: number[];
  status: PolicyDistributionStatus;
  distributedAt?: string;
  distributedBy?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyDistributionWithStats extends PolicyDistribution {
  totalRecipients: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  failedQuiz: number;
  complianceRate: number;
  documentTitle?: string;
}

export interface PolicyAcknowledgmentRecord {
  id: string;
  orgId: string;
  distributionId: string;
  userId: string;
  status: PolicyAcknowledgmentStatus;
  acknowledgedAt?: string;
  signatureHash?: string;
  quizScore?: number;
  quizPassed?: boolean;
  readDurationSeconds?: number;
  ipAddress?: string;
  userAgent?: string;
  remindersSent: number;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyAcknowledgmentWithUser extends PolicyAcknowledgmentRecord {
  userName?: string;
  userEmail?: string;
  department?: string;
}

export interface MyPendingPolicy {
  distributionId: string;
  distributionTitle: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  documentContent?: string;
  deadline: string;
  isMandatory: boolean;
  requiresQuiz: boolean;
  quizQuestions?: QuizQuestion[];
  quizPassThreshold?: number;
  status: PolicyAcknowledgmentStatus;
  acknowledgedAt?: string;
  signatureHash?: string;
  quizScore?: number;
}

export interface PolicyQuizResponseRecord {
  id: string;
  acknowledgmentId: string;
  questionIndex: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

export interface ComplianceDashboard {
  activeDistributions: number;
  avgComplianceRate: number;
  overdueCount: number;
  quizFailureRate: number;
  perDistribution: Array<{
    distributionId: string;
    title: string;
    documentTitle: string;
    complianceRate: number;
    total: number;
    acknowledged: number;
    overdue: number;
    deadline: string;
  }>;
  perDepartment: Array<{
    department: string;
    complianceRate: number;
    total: number;
    acknowledged: number;
  }>;
}
