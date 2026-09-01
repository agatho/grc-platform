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

import { db, catalog, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  AiPolicyViolationError,
  aiCompleteGoverned,
  buildPolicyDraftPrompt,
  getAvailableProviders,
  safeJsonParse,
} from "@grc/ai";
import { aiDraftPolicySchema, aiPolicyDraftResponseSchema } from "@grc/shared";
import { eq, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";

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

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiDraftPolicySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // [WP6 · S05-02] Frueh scheitern, bevor die Route DB-Arbeit leistet:
  // hat der Betreiber ueberhaupt keinen Provider freigeschaltet, ist der
  // Aufruf aussichtslos. Die eigentliche Richtlinienpruefung (Org-Ebene,
  // Jurisdiktion, Nutzerwunsch) macht `aiCompleteGoverned`.
  if (getAvailableProviders().length === 0) {
    return aiErrorResponse(
      new AiPolicyViolationError({
        code: "no_provider_configured",
        message:
          "Es ist kein KI-Provider konfiguriert. Der Betreiber muss einen Provider " +
          "ausdruecklich freischalten (lokal: OLLAMA_BASE_URL / LMSTUDIO_BASE_URL; " +
          "Cloud: ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_AI_API_KEY / " +
          "CLAUDE_CLI_ENABLED=true).",
      }),
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

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.draft_policy",
      orgId: ctx.orgId,
      userId: ctx.userId,
      messages: prompt,
      maxTokens: 4000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: aiPolicyDraftResponseSchema,
    });

    return aiJson(
      {
        title: result.data.title,
        content: result.data.content,
        coveredRequirements: result.data.coveredRequirements,
        requirements: entries.map((e) => ({ id: e.id, code: e.code })),
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
