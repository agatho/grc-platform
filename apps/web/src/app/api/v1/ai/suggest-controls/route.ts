// AI-Assist #2: POST /api/v1/ai/suggest-controls
//
// Suggests up to 5 controls for a risk: either linking one of the org's
// existing controls or creating a new one. Candidate ranking uses two
// strategies (migration 0377):
//   1. pgvector embeddings — when the org has synced control_embedding
//      rows for the active embedding model (control-embedding-sync
//      worker cron), the top 20 candidates come from cosine similarity
//      (`<=>`) between a query embedding of the risk text and the
//      stored control embeddings.
//   2. Token-overlap fallback — the original heuristic, used when no
//      embedding provider is configured, the org has no embeddings yet,
//      or the embedding call fails. Deterministic and dependency-free.
// Suggestions are proposals only; linking/creating happens
// through the existing APIs after an explicit user click:
//   POST /api/v1/controls/:id/risk-links   (link existing)
//   POST /api/v1/controls                   (create new)
//
// Security: DB texts go to the model as delimited data (see
// packages/ai/src/prompts/erm.ts). The AI response is Zod-validated and
// "link_existing" suggestions are additionally filtered server-side to
// the candidate set — the model cannot smuggle in foreign control IDs.

import { db, risk, control, riskControl, aiPromptLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  aiComplete,
  buildControlAdvisorPrompt,
  generateEmbedding,
  getAvailableProviders,
  getEmbeddingProvider,
  safeJsonParse,
} from "@grc/ai";
import {
  aiSuggestControlsSchema,
  aiControlSuggestionsResponseSchema,
} from "@grc/shared";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-zà-üß0-9]+/i)
      .filter((w) => w.length > 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

interface CandidateControl {
  id: string;
  title: string;
  description: string | null;
  controlType: string;
  status: string;
  score: number;
}

/**
 * Embedding-based candidate selection (strategy 1). Returns null when
 * the embedding path is unavailable — no provider configured, no synced
 * embeddings for this org+model, embedding call failed, or the result
 * set is empty — so the caller falls back to token overlap.
 */
async function embeddingCandidates(
  orgId: string,
  riskText: string,
  linkedIds: Set<string>,
): Promise<CandidateControl[] | null> {
  const provider = getEmbeddingProvider();
  if (!provider) return null;

  try {
    const countRows = (await db.execute(
      sql`SELECT count(*)::int AS n FROM control_embedding WHERE org_id = ${orgId}::uuid AND model = ${provider.model}`,
    )) as unknown as Array<{ n: number }>;
    if (!countRows[0] || Number(countRows[0].n) === 0) return null;

    const queryVector = await generateEmbedding(riskText, provider);
    const vectorLiteral = `[${queryVector.join(",")}]`;

    // Cosine distance operator `<=>` (pgvector), served by the HNSW index
    // ctrl_emb_hnsw_cosine_idx (migration 0377). LIMIT 40 leaves headroom
    // for filtering out already-linked controls before slicing to 20.
    const rows = (await db.execute(sql`
      SELECT c.id,
             c.title,
             c.description,
             c.control_type AS "controlType",
             c.status,
             1 - (ce.embedding <=> ${vectorLiteral}::vector) AS score
      FROM control_embedding ce
      INNER JOIN control c ON c.id = ce.control_id
      WHERE ce.org_id = ${orgId}::uuid
        AND c.org_id = ${orgId}::uuid
        AND ce.model = ${provider.model}
        AND c.deleted_at IS NULL
      ORDER BY ce.embedding <=> ${vectorLiteral}::vector ASC
      LIMIT 40
    `)) as unknown as CandidateControl[];

    const filtered = rows
      .filter((r) => !linkedIds.has(r.id))
      .slice(0, 20)
      .map((r) => ({ ...r, score: Number(r.score) }));
    return filtered.length > 0 ? filtered : null;
  } catch {
    // Embedding provider hiccup — or control_embedding does not exist
    // yet (migration 0377 no-ops until pgvector is installed on the
    // server). The deterministic token-overlap fallback covers both.
    return null;
  }
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

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

  const body = aiSuggestControlsSchema.safeParse(
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

  // Load the risk (org-scoped).
  const [riskRow] = await db
    .select({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(risk)
    .where(
      and(
        eq(risk.id, body.data.riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    )
    .limit(1);

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Already-linked controls (context + dedupe target).
  const linked = await db
    .select({
      controlId: riskControl.controlId,
      title: control.title,
      controlType: control.controlType,
    })
    .from(riskControl)
    .innerJoin(control, eq(control.id, riskControl.controlId))
    .where(
      and(
        eq(riskControl.riskId, body.data.riskId),
        eq(riskControl.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  const linkedIds = new Set(linked.map((l) => l.controlId));

  // Candidate pool — strategy 1: pgvector cosine similarity over the
  // org's synced control embeddings (see embeddingCandidates above).
  const riskText = `${riskRow.title} ${riskRow.description ?? ""} ${riskRow.riskCategory}`;
  let candidates = await embeddingCandidates(ctx.orgId, riskText, linkedIds);

  // Strategy 2 (fallback): the org's controls ranked by token overlap
  // with the risk text — dependency-free and deterministic.
  if (!candidates) {
    const orgControls = await db
      .select({
        id: control.id,
        title: control.title,
        description: control.description,
        controlType: control.controlType,
        status: control.status,
      })
      .from(control)
      .where(and(eq(control.orgId, ctx.orgId), isNull(control.deletedAt)))
      .limit(500);

    const riskTokens = tokenize(riskText);
    candidates = orgControls
      .filter((c) => !linkedIds.has(c.id))
      .map((c) => ({
        ...c,
        score: overlapScore(
          riskTokens,
          tokenize(`${c.title} ${c.description ?? ""}`),
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  const prompt = buildControlAdvisorPrompt({
    risk: {
      title: riskRow.title,
      description: riskRow.description,
      category: riskRow.riskCategory,
      inherentScore: riskRow.riskScoreInherent,
      residualScore: riskRow.riskScoreResidual,
    },
    linkedControls: linked.map((l) => ({
      title: l.title,
      controlType: l.controlType,
    })),
    candidateControls: candidates.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      controlType: c.controlType,
      status: c.status,
    })),
    locale: "de",
  });

  const startMs = Date.now();
  let response;
  try {
    response = await aiComplete({
      messages: prompt,
      maxTokens: 2000,
      temperature: 0.3,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "ai-assist/suggest-controls",
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
    model: response.model,
    latencyMs: Date.now() - startMs,
    cachedResult: false,
  });

  const parsed = safeJsonParse<unknown>(response.text);
  const validated = aiControlSuggestionsResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return Response.json(
      {
        error:
          "The AI returned unparseable or invalid suggestions. Please try again.",
        rawSample: response.text.slice(0, 300),
      },
      { status: 422 },
    );
  }

  // Server-side hardening: link_existing must reference a candidate the
  // server offered — anything else (hallucinated or injected IDs) drops.
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const suggestions = validated.data.suggestions
    .filter(
      (s) => s.type !== "link_existing" || candidateById.has(s.controlId),
    )
    .slice(0, 5)
    .map((s) =>
      s.type === "link_existing"
        ? {
            ...s,
            controlTitle: candidateById.get(s.controlId)?.title ?? "",
            controlType: candidateById.get(s.controlId)?.controlType ?? "",
          }
        : s,
    );

  return Response.json({
    data: {
      riskId: body.data.riskId,
      suggestions,
      provider: response.provider,
      model: response.model,
    },
  });
}
