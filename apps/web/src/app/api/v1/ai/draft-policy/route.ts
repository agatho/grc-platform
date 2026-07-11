// AI-Assist #1: POST /api/v1/ai/draft-policy
//
// Drafts a policy/procedure/guideline document from 1-20 framework
// requirements (generic catalog_entry rows). The result is a PROPOSAL
// only — nothing is persisted here; the UI creates the document via
// POST /api/v1/documents after an explicit user click.
//
// Security: catalog texts + user context are passed to the model as
// delimited data (see packages/ai/src/prompts/dms.ts); the AI response
// is parsed with safeJsonParse and validated with Zod — parse failure
// returns 422, never a crash.

import { db, catalog, catalogEntry, aiPromptLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  aiComplete,
  buildPolicyDraftPrompt,
  getAvailableProviders,
  safeJsonParse,
} from "@grc/ai";
import { aiDraftPolicySchema, aiPolicyDraftResponseSchema } from "@grc/shared";
import { eq, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
    "ciso",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // ADR-019 pattern (see copilot messages route): per-user token bucket.
  const limit = await rateLimit({
    key: `ai-assist:${ctx.userId}`,
    ...LIMITS.AI_ASSIST,
  });
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        type: "https://arctos.charliehund.de/errors/rate-limited",
        title: "Rate limit exceeded",
        status: 429,
        detail: `AI-assist rate limit exceeded. Retry in ${limit.retryAfterSeconds}s.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/problem+json; charset=utf-8",
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  const body = aiDraftPolicySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  if (getAvailableProviders().length === 0) {
    return Response.json(
      {
        error:
          "AI features require a configured LLM provider. Set an API key (or enable Ollama) in the server environment.",
      },
      { status: 503 },
    );
  }

  // Load the requested framework requirements. catalog/catalog_entry are
  // platform-wide reference data (no org_id) — no org filter needed.
  const entries = await db
    .select({
      id: catalogEntry.id,
      code: catalogEntry.code,
      name: catalogEntry.name,
      nameDe: catalogEntry.nameDe,
      description: catalogEntry.description,
      descriptionDe: catalogEntry.descriptionDe,
      frameworkName: catalog.name,
    })
    .from(catalogEntry)
    .innerJoin(catalog, eq(catalogEntry.catalogId, catalog.id))
    .where(inArray(catalogEntry.id, body.data.catalogEntryIds));

  if (entries.length === 0) {
    return Response.json(
      { error: "No matching catalog entries found" },
      { status: 404 },
    );
  }

  const preferDe = body.data.language === "de";
  const prompt = buildPolicyDraftPrompt({
    documentCategory: body.data.documentCategory,
    language: body.data.language,
    orgContext: body.data.context ?? null,
    requirements: entries.map((e) => ({
      code: e.code,
      title: (preferDe ? (e.nameDe ?? e.name) : e.name) ?? e.code,
      description: preferDe
        ? (e.descriptionDe ?? e.description)
        : (e.description ?? e.descriptionDe),
      framework: e.frameworkName,
    })),
  });

  const startMs = Date.now();
  let response;
  try {
    response = await aiComplete({
      messages: prompt,
      maxTokens: 4000,
      temperature: 0.3,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  // Cost transparency: log usage regardless of parse outcome.
  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "ai-assist/draft-policy",
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
    model: response.model,
    latencyMs: Date.now() - startMs,
    cachedResult: false,
  });

  const parsed = safeJsonParse<unknown>(response.text);
  const validated = aiPolicyDraftResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return Response.json(
      {
        error:
          "The AI returned an unparseable or invalid draft. Please try again.",
        rawSample: response.text.slice(0, 300),
      },
      { status: 422 },
    );
  }

  return Response.json({
    data: {
      title: validated.data.title,
      content: validated.data.content,
      coveredRequirements: validated.data.coveredRequirements,
      requirements: entries.map((e) => ({ id: e.id, code: e.code })),
      provider: response.provider,
      model: response.model,
    },
  });
}
