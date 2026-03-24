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
