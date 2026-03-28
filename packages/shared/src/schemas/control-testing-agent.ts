import { z } from "zod";

// Sprint 70: AI Control Testing Agent Zod Schemas

// ─── Control Test Script ─────────────────────────────────────

export const createTestScriptSchema = z.object({
  controlId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  testType: z.enum(["automated", "manual", "hybrid"]),
  scriptContent: z.string().min(1).max(100000),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    instruction: z.string().min(1).max(2000),
    expectedResult: z.string().max(2000).optional(),
    isAutomated: z.boolean().default(false),
  })).max(50).optional(),
  connectorType: z.enum(["api", "database", "file_system", "cloud"]).optional(),
  connectorConfig: z.record(z.unknown()).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "on_demand"]).optional(),
  expectedDurationMinutes: z.number().int().min(1).max(10080).optional(),
  severityMapping: z.record(z.string()).optional(),
});

export const updateTestScriptSchema = createTestScriptSchema.partial().omit({ controlId: true });

export const testScriptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  controlId: z.string().uuid().optional(),
  testType: z.enum(["automated", "manual", "hybrid"]).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Generate Test Script (AI) ───────────────────────────────

export const generateTestScriptSchema = z.object({
  controlId: z.string().uuid(),
  testType: z.enum(["automated", "manual", "hybrid"]).default("hybrid"),
  context: z.string().max(10000).optional(),
});

// ─── Control Test Execution ──────────────────────────────────

export const runTestExecutionSchema = z.object({
  scriptId: z.string().uuid(),
  triggeredBy: z.enum(["manual", "scheduled", "agent"]).default("manual"),
});

export const testExecutionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  controlId: z.string().uuid().optional(),
  scriptId: z.string().uuid().optional(),
  status: z.enum(["pending", "running", "passed", "failed", "error", "cancelled"]).optional(),
  result: z.enum(["pass", "fail", "inconclusive"]).optional(),
});

// ─── Control Test Checklist ──────────────────────────────────

export const createChecklistSchema = z.object({
  controlId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  items: z.array(z.object({
    order: z.number().int().min(1),
    question: z.string().min(1).max(2000),
    guidance: z.string().max(5000).optional(),
    evidenceRequired: z.boolean().default(false),
  })).min(1).max(100),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateChecklistSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  status: z.enum(["in_progress", "completed", "archived"]).optional(),
  items: z.array(z.object({
    order: z.number().int().min(1),
    question: z.string().min(1).max(2000),
    guidance: z.string().max(5000).optional(),
    evidenceRequired: z.boolean().default(false),
    response: z.enum(["yes", "no", "na", "partial"]).optional(),
    notes: z.string().max(5000).optional(),
  })).max(100).optional(),
  assigneeId: z.string().uuid().optional(),
});

export const generateChecklistSchema = z.object({
  controlId: z.string().uuid(),
  context: z.string().max(10000).optional(),
});

export const checklistQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  controlId: z.string().uuid().optional(),
  status: z.enum(["draft", "in_progress", "completed", "archived"]).optional(),
  assigneeId: z.string().uuid().optional(),
});

// ─── Control Test Learning ───────────────────────────────────

export const learningQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  controlId: z.string().uuid().optional(),
  patternType: z.enum(["common_failure", "effective_test", "false_positive", "improvement"]).optional(),
});
