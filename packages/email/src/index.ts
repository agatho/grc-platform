// Service
export { EmailService, emailService } from "./EmailService";

// Types
export type { EmailParams, EmailResult, EmailTemplateKey } from "./types";

// Templates
export { TaskAssigned, getSubject as getTaskAssignedSubject } from "./templates/TaskAssigned";
export { TaskOverdue, getSubject as getTaskOverdueSubject } from "./templates/TaskOverdue";
export { TaskReminder, getSubject as getTaskReminderSubject } from "./templates/TaskReminder";
export { UserInvited, getSubject as getUserInvitedSubject } from "./templates/UserInvited";
export { NotificationDigest, getSubject as getNotificationDigestSubject } from "./templates/NotificationDigest";
