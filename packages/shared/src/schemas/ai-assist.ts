// AI-Assist feature schemas — request validation for the three
// /api/v1/ai/* assist endpoints AND server-side validation of the
// structured AI responses. AI output is never trusted: every response
// is parsed with safeJsonParse and then validated against the schemas
// below before anything is returned to the client. Nothing is
// persisted without an explicit user action in the UI.

import { z } from "zod";

// ─── Request: POST /api/v1/ai/draft-policy ─────────────────────

export const aiDraftPolicySchema = z.object({
  catalogEntryIds: z.array(z.string().uuid()).min(1).max(20),
  documentCategory: z.enum(["policy", "procedure", "guideline"]),
  language: z.enum(["de", "en"]),
  context: z.string().max(2000).optional(),
});

export type AiDraftPolicyRequest = z.infer<typeof aiDraftPolicySchema>;

// ─── Request: POST /api/v1/ai/suggest-controls ─────────────────

export const aiSuggestControlsSchema = z.object({
  riskId: z.string().uuid(),
});

export type AiSuggestControlsRequest = z.infer<typeof aiSuggestControlsSchema>;

// ─── Request: POST /api/v1/ai/explain-gap ──────────────────────

export const aiExplainGapSchema = z
  .object({
    soaEntryId: z.string().uuid().optional(),
    catalogEntryId: z.string().uuid().optional(),
    language: z.enum(["de", "en"]).default("de"),
  })
  .refine((v) => Boolean(v.soaEntryId) !== Boolean(v.catalogEntryId), {
    message: "Provide exactly one of soaEntryId or catalogEntryId",
  });

export type AiExplainGapRequest = z.infer<typeof aiExplainGapSchema>;

// ─── AI response: policy draft ─────────────────────────────────

export const aiPolicyDraftResponseSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(200_000),
  coveredRequirements: z.array(z.string().max(100)).max(50).default([]),
});

export type AiPolicyDraftResponse = z.infer<typeof aiPolicyDraftResponseSchema>;

// ─── AI response: control suggestions ──────────────────────────

export const aiControlSuggestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("link_existing"),
    controlId: z.string().uuid(),
    reason: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("create_new"),
    title: z.string().min(1).max(500),
    description: z.string().max(5000).default(""),
    controlType: z.enum(["preventive", "detective", "corrective"]),
    reason: z.string().min(1).max(2000),
  }),
]);

export const aiControlSuggestionsResponseSchema = z.object({
  suggestions: z.array(aiControlSuggestionSchema).max(5),
});

export type AiControlSuggestion = z.infer<typeof aiControlSuggestionSchema>;
export type AiControlSuggestionsResponse = z.infer<
  typeof aiControlSuggestionsResponseSchema
>;

// ─── AI response: gap explanation ──────────────────────────────

export const aiGapExplanationResponseSchema = z.object({
  explanation: z.string().min(1).max(10_000),
  suggestedSteps: z.array(z.string().min(1).max(1000)).min(1).max(10),
  suggestedEvidence: z.array(z.string().min(1).max(1000)).min(1).max(10),
});

export type AiGapExplanationResponse = z.infer<
  typeof aiGapExplanationResponseSchema
>;
