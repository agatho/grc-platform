// Service
export { EmailService, emailService } from "./EmailService";

// Types
export type { EmailParams, EmailResult, EmailTemplateKey } from "./types";

// Templates
export {
  TaskAssigned,
  getSubject as getTaskAssignedSubject,
} from "./templates/TaskAssigned";
export {
  TaskOverdue,
  getSubject as getTaskOverdueSubject,
} from "./templates/TaskOverdue";
export {
  TaskReminder,
  getSubject as getTaskReminderSubject,
} from "./templates/TaskReminder";
export {
  UserInvited,
  getSubject as getUserInvitedSubject,
} from "./templates/UserInvited";
export {
  NotificationDigest,
  getSubject as getNotificationDigestSubject,
} from "./templates/NotificationDigest";
export {
  DataBreach72hWarning,
  getSubject as getDataBreach72hWarningSubject,
} from "./templates/DataBreach72hWarning";
export {
  DataBreach72hOverdue,
  getSubject as getDataBreach72hOverdueSubject,
} from "./templates/DataBreach72hOverdue";
export {
  DataBreachIndividualNotification,
  getSubject as getDataBreachIndividualNotificationSubject,
} from "./templates/DataBreachIndividualNotification";
export {
  DsrReceived,
  getSubject as getDsrReceivedSubject,
} from "./templates/DsrReceived";
export {
  DsrDeadlineWarning,
  getSubject as getDsrDeadlineWarningSubject,
} from "./templates/DsrDeadlineWarning";
export {
  DsrCompleted,
  getSubject as getDsrCompletedSubject,
} from "./templates/DsrCompleted";
export {
  RopaReviewDue,
  getSubject as getRopaReviewDueSubject,
} from "./templates/RopaReviewDue";
export {
  DpiaRequired,
  getSubject as getDpiaRequiredSubject,
} from "./templates/DpiaRequired";
export {
  CrisisActivated,
  getSubject as getCrisisActivatedSubject,
} from "./templates/CrisisActivated";
export {
  CrisisResolved,
  getSubject as getCrisisResolvedSubject,
} from "./templates/CrisisResolved";
export {
  BcpReviewDue,
  getSubject as getBcpReviewDueSubject,
} from "./templates/BcpReviewDue";
export {
  ExerciseReminder,
  getSubject as getExerciseReminderSubject,
} from "./templates/ExerciseReminder";
export {
  BiaOverdue,
  getSubject as getBiaOverdueSubject,
} from "./templates/BiaOverdue";
export {
  AuditPlanApproved,
  getSubject as getAuditPlanApprovedSubject,
} from "./templates/AuditPlanApproved";
export {
  AuditFindingAssigned,
  getSubject as getAuditFindingAssignedSubject,
} from "./templates/AuditFindingAssigned";
export {
  AuditScheduled,
  getSubject as getAuditScheduledSubject,
} from "./templates/AuditScheduled";
export {
  VendorDdQuestionnaire,
  getSubject as getVendorDdQuestionnaireSubject,
} from "./templates/VendorDdQuestionnaire";
export {
  ContractExpiryNotice,
  getSubject as getContractExpiryNoticeSubject,
} from "./templates/ContractExpiryNotice";
export {
  SlaBreachAlert,
  getSubject as getSlaBreachAlertSubject,
} from "./templates/SlaBreachAlert";
export {
  VendorReassessmentDue,
  getSubject as getVendorReassessmentDueSubject,
} from "./templates/VendorReassessmentDue";
