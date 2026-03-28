import { z } from "zod";

// Sprint 67: GRC Copilot Enterprise Chat Zod Schemas

// ─── Conversation ────────────────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().max(500).optional(),
  language: z.enum(["de", "en", "fr", "es"]).default("de"),
  contextModule: z.string().max(50).optional(),
  contextEntityType: z.string().max(50).optional(),
  contextEntityId: z.string().uuid().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().max(500).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const conversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  contextModule: z.string().max(50).optional(),
  isArchived: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
});

// ─── Message (Chat) ─────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  language: z.enum(["de", "en", "fr", "es"]).optional(),
  templateKey: z.string().max(100).optional(),
  templateVariables: z.record(z.string()).optional(),
  contextModule: z.string().max(50).optional(),
  contextEntityType: z.string().max(50).optional(),
  contextEntityId: z.string().uuid().optional(),
});

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

// ─── Prompt Template ─────────────────────────────────────────

export const createPromptTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  systemPrompt: z.string().min(1).max(50000),
  userPromptTemplate: z.string().min(1).max(50000),
  category: z.enum(["risk", "control", "compliance", "general", "audit", "process"]),
  moduleKey: z.string().max(50).optional(),
  variables: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(["string", "number", "boolean", "date"]),
    required: z.boolean().default(false),
    description: z.string().max(500).optional(),
  })).max(20).optional(),
});

export const updatePromptTemplateSchema = createPromptTemplateSchema.partial().omit({ key: true });

export const promptTemplateQuerySchema = z.object({
  category: z.string().max(50).optional(),
  moduleKey: z.string().max(50).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── RAG Source ──────────────────────────────────────────────

export const ragIndexRequestSchema = z.object({
  sourceTypes: z.array(z.enum(["risk", "control", "process", "document", "policy", "finding"])).min(1).max(10),
  forceReindex: z.boolean().default(false),
});

// ─── Suggested Action ────────────────────────────────────────

export const updateSuggestedActionSchema = z.object({
  status: z.enum(["accepted", "dismissed", "executed"]),
});

// ─── Feedback ────────────────────────────────────────────────

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(-1).max(1).refine((v) => v !== 0, "Rating must be -1 or 1"),
  comment: z.string().max(2000).optional(),
});

// ─── Copilot Usage Query ─────────────────────────────────────

export const copilotUsageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
