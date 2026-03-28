import { z } from "zod";

// ── Sprint 57: API Platform und Developer Portal ──

// API Key
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).default(60),
  rateLimitPerDay: z.number().int().min(1).max(1000000).default(10000),
  allowedIps: z.array(z.string().max(45)).max(50).default([]),
  scopeIds: z.array(z.string().uuid()).min(1).max(100),
});

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
  rateLimitPerDay: z.number().int().min(1).max(1000000).optional(),
  allowedIps: z.array(z.string().max(45)).max(50).optional(),
  scopeIds: z.array(z.string().uuid()).min(1).max(100).optional(),
});

export const revokeApiKeySchema = z.object({
  reason: z.string().max(500).optional(),
});

// Developer App
export const createDeveloperAppSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  redirectUris: z.array(z.string().url().max(500)).min(1).max(10),
  grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token"])).min(1).default(["authorization_code"]),
  logoUrl: z.string().url().max(500).optional(),
  homepageUrl: z.string().url().max(500).optional(),
  privacyUrl: z.string().url().max(500).optional(),
  tosUrl: z.string().url().max(500).optional(),
});

export const updateDeveloperAppSchema = createDeveloperAppSchema.partial();

// Playground Snippet
export const createPlaygroundSnippetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(500),
  headers: z.record(z.string()).default({}),
  queryParams: z.record(z.string()).default({}),
  body: z.string().max(50000).optional(),
  isPublic: z.boolean().default(false),
});

export const updatePlaygroundSnippetSchema = createPlaygroundSnippetSchema.partial();

// API Usage query
export const apiUsageQuerySchema = z.object({
  apiKeyId: z.string().uuid().optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type CreateDeveloperAppInput = z.infer<typeof createDeveloperAppSchema>;
export type UpdateDeveloperAppInput = z.infer<typeof updateDeveloperAppSchema>;
export type CreatePlaygroundSnippetInput = z.infer<typeof createPlaygroundSnippetSchema>;
export type UpdatePlaygroundSnippetInput = z.infer<typeof updatePlaygroundSnippetSchema>;
export type ApiUsageQuery = z.infer<typeof apiUsageQuerySchema>;
