import { z } from "zod";

// Organization schemas (Sprint 1)
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().max(50).optional(),
  type: z.enum(["subsidiary", "holding", "joint_venture", "branch"]).default("subsidiary"),
  country: z.string().length(3).default("DEU"),
  isEu: z.boolean().default(true),
  parentOrgId: z.string().uuid().optional(),
  legalForm: z.string().max(100).optional(),
  dpoName: z.string().max(255).optional(),
  dpoEmail: z.string().email().optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// User invitation schema
export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
  department: z.string().max(255).optional(),
});

// Role assignment schema
export const assignRoleSchema = z.object({
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
});

// Invitation schemas (S1-13)
export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "risk_manager", "control_owner", "auditor", "dpo", "viewer", "process_owner"]),
  lineOfDefense: z.enum(["first", "second", "third"]).optional(),
});

export const acceptInvitationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).max(128).optional(),
});

// Task schemas (Sprint 1.2)
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  sourceEntityType: z.string().max(50).optional(),
  sourceEntityId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskStatusTransitionSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "overdue", "cancelled"]),
});

// Organization GDPR update schema (Sprint 1.2)
export const updateOrganizationGdprSchema = z.object({
  orgCode: z
    .string()
    .max(10)
    .regex(/^[A-Za-z0-9]*$/, "orgCode must be alphanumeric")
    .optional(),
  isDataController: z.boolean().optional(),
  dpoUserId: z.string().uuid().nullable().optional(),
  supervisoryAuthority: z.string().max(500).nullable().optional(),
  dataResidency: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, "dataResidency must be 2 uppercase letters")
    .nullable()
    .optional(),
  gdprSettings: z.record(z.unknown()).optional(),
});

// DPO assignment schema (Sprint 1.2)
export const assignDpoSchema = z.object({
  dpoUserId: z.string().uuid(),
});

// Scheduled notification schema (Sprint 1.2)
export const createScheduledNotificationSchema = z.object({
  recipientRole: z
    .enum([
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "process_owner",
      "viewer",
    ])
    .optional(),
  recipientUserIds: z.array(z.string().uuid()).optional(),
  subject: z.string().min(1).max(500),
  message: z.string().min(1),
  scheduledFor: z.string().datetime(),
  templateKey: z.string().max(100).optional(),
});

// Notification preferences schema (Sprint 1.2)
export const updateNotificationPreferencesSchema = z.object({
  emailMode: z.enum(["immediate", "daily_digest", "disabled"]),
  digestTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "digestTime must be HH:mm format")
    .optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "quietHoursStart must be HH:mm format")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "quietHoursEnd must be HH:mm format")
    .optional(),
});
