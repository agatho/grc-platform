import { z } from "zod";

// Sprint 13: GRC Budget, Cost Tracking & ROI schemas

const budgetStatusValues = ["draft", "submitted", "approved"] as const;
const grcAreaValues = ["erm", "isms", "ics", "dpms", "audit", "tprm", "bcms", "esg", "general"] as const;
const costCategoryValues = ["personnel", "external", "tools", "training", "measures", "certification"] as const;
const costTypeValues = ["planned", "actual", "forecast"] as const;
const roiMethodValues = ["ale_reduction", "penalty_avoidance", "incident_prevention", "roni"] as const;

// ─── Budget CRUD ────────────────────────────────────────────

export const createBudgetSchema = z.object({
  year: z.number().int().min(2020).max(2099),
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
  notes: z.string().max(2000).optional(),
});

export const updateBudgetSchema = z.object({
  totalAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(budgetStatusValues).optional(),
  notes: z.string().max(2000).optional(),
});

// ─── Budget Line CRUD ───────────────────────────────────────

export const createBudgetLineSchema = z.object({
  grcArea: z.enum(grcAreaValues),
  costCategory: z.enum(costCategoryValues),
  plannedAmount: z.number().nonnegative(),
  q1Amount: z.number().nonnegative().optional(),
  q2Amount: z.number().nonnegative().optional(),
  q3Amount: z.number().nonnegative().optional(),
  q4Amount: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const bulkCreateBudgetLinesSchema = z.object({
  lines: z.array(createBudgetLineSchema).min(1).max(100),
});

// ─── Cost Entry CRUD ────────────────────────────────────────

export const createCostEntrySchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  costCategory: z.enum(costCategoryValues),
  costType: z.enum(costTypeValues).default("actual"),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  department: z.string().max(200).optional(),
  hours: z.number().nonnegative().optional(),
  hourlyRate: z.number().nonnegative().optional(),
  description: z.string().max(2000).optional(),
  budgetId: z.string().uuid().optional(),
  invoiceRef: z.string().max(200).optional(),
});

// ─── Time Entry CRUD ────────────────────────────────────────

export const createTimeEntrySchema = z.object({
  taskId: z.string().uuid().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
  grcArea: z.enum(grcAreaValues),
  department: z.string().max(200).optional(),
  hours: z.number().positive().max(24),
  date: z.string().date(),
  description: z.string().max(2000).optional(),
});

// ─── ROI Recompute ──────────────────────────────────────────

export const roiRecomputeSchema = z.object({
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
});

// ─── RONI Scenario ──────────────────────────────────────────

export const roniScenarioSchema = z.object({
  cutPercent: z.number().min(1).max(100),
});
