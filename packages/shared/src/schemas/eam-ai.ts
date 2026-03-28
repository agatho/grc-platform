import { z } from "zod";

// Sprint 51: EAM AI Assistant Zod Schemas

export const llmProviderEnum = z.enum(["openai", "anthropic", "azure_openai", "ollama", "mistral", "custom"]);

export const aiConfigSchema = z.object({
  provider: llmProviderEnum,
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().url().max(2000).optional(),
  model: z.string().max(200).optional(),
  maxTokens: z.number().int().min(100).max(128000).default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  organizationId: z.string().max(200).optional(),
  azureDeployment: z.string().max(200).optional(),
  azureApiVersion: z.string().max(50).optional(),
});

export const generateSuggestionsSchema = z.object({
  objectType: z.enum(["application", "business_capability", "it_component", "data_object"]),
  industry: z.string().min(1).max(200),
  count: z.number().int().min(1).max(20).default(5),
  existingObjects: z.array(z.string().max(500)).max(50).optional(),
  language: z.enum(["en", "de"]).default("en"),
});

export const generateDescriptionSchema = z.object({
  entityId: z.string().uuid(),
  language: z.enum(["en", "de"]).default("en"),
  tone: z.enum(["professional", "technical", "executive"]).default("professional"),
});

export const bulkDescriptionSchema = z.object({
  entityIds: z.array(z.string().uuid()).min(1).max(50),
  language: z.enum(["en", "de"]).default("en"),
});

export const translateSchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.string().max(30),
  fieldName: z.string().max(50),
  sourceText: z.string().min(1).max(10000),
  targetLanguage: z.enum(["en", "de", "fr", "es", "it"]),
});

export const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export const updatePromptSchema = z.object({
  templateText: z.string().min(10).max(5000),
  variables: z.array(z.object({
    name: z.string().max(50),
    type: z.string().max(20),
    description: z.string().max(200).optional(),
  })).max(20).optional(),
});
