import { z } from "zod";

// Sprint 12: Whistleblowing (HinSchG) schemas

export const wbCategoryValues = ["fraud", "corruption", "discrimination", "privacy", "environmental", "health_safety", "other"] as const;
export const wbCaseStatusValues = ["received", "acknowledged", "investigating", "resolved", "closed"] as const;
export const wbPriorityValues = ["low", "medium", "high", "critical"] as const;
export const wbResolutionCategoryValues = ["substantiated", "unsubstantiated", "inconclusive", "referred"] as const;

export const submitReportSchema = z.object({
  category: z.enum(wbCategoryValues),
  description: z.string().min(20).max(10000),
  contactEmail: z.string().email().optional(),
  language: z.enum(["de", "en"]).default("de"),
});

export const replyToMailboxSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const acknowledgeCaseSchema = z.object({
  message: z.string().max(2000).optional(),
});

export const resolveCaseSchema = z.object({
  resolution: z.string().min(10).max(10000),
  resolutionCategory: z.enum(wbResolutionCategoryValues),
  message: z.string().max(5000).optional(),
});

export const assignWbCaseSchema = z.object({
  assignedTo: z.string().uuid(),
});

export const sendWbMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const wbCaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(wbCaseStatusValues).optional(),
  category: z.enum(wbCategoryValues).optional(),
  priority: z.enum(wbPriorityValues).optional(),
});
