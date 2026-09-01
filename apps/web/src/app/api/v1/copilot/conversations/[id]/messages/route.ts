// [ARCTOS-FULL-2026-08-31 / WP6 · S05-17, S05-21, S05-06, S05-09, S05-12]
//
// Der Endpunkt war ein Stub, der die Nutzereingabe zurückspiegelte:
//
//   const aiResponseContent = `[AI Response] Processing query: "${…}"`;
//
// und sie als Assistentennachricht mit dem Inhaltstyp Markdown ablegte.
// In `CLAUDE.md` stand dazu „GRC Copilot … ✅ Done". Zwei Konsequenzen:
// die Doku-Aussage war falsch (S05-17), und die zurückgespiegelte
// Nutzereingabe lag als „markdown" im Bestand — self-XSS, sobald je ein
// Markdown-Renderer angebunden würde (S05-21).
//
// Jetzt: ein echter, richtliniengebundener Modellaufruf mit
// RAG-Kontext aus `copilot_rag_source` (org-gescopt). `contentType`
// bleibt `text`, weil es im Produkt keinen Markdown-Renderer gibt — die
// Zusicherung aus S05-21 wird damit nicht durch die Hintertür verletzt.

import { db, copilotConversation, copilotMessage } from "@grc/db";
import { sendMessageSchema, messageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, lt, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import {
  aiCompleteGoverned,
  buildCopilotPrompt,
  copilotAnswerSchema,
  safeJsonParse,
} from "@grc/ai";
import { aiErrorResponse } from "../../../../ai/_shared/ai-route";

// POST /api/v1/copilot/conversations/:id/messages — Send message + get AI response
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  // ADR-019: copilot calls are the priciest AI op in the app. Limit per user.
  const limit = await rateLimit({
    key: `copilot:${ctx.userId}`,
    ...LIMITS.COPILOT,
  });
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        type: "https://arctos.charliehund.de/errors/rate-limited",
        title: "Rate limit exceeded",
        status: 429,
        detail: `Copilot rate limit exceeded. Retry in ${limit.retryAfterSeconds}s.`,
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

  const { id } = await params;
  const body = sendMessageSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify conversation exists and belongs to user
  const [conv] = await db
    .select()
    .from(copilotConversation)
    .where(
      and(
        eq(copilotConversation.id, id),
        eq(copilotConversation.orgId, ctx.orgId),
      ),
    );

  if (!conv)
    return Response.json({ error: "Conversation not found" }, { status: 404 });

  // RAG-Kontext: einfache Volltextauswahl über die indizierten Quellen
  // dieser Organisation. Der Index selbst wird von
  // `copilot-rag-indexer` gepflegt (Eigentum WP8) — hier wird nur
  // gelesen, org-gescopt und längenbegrenzt.
  const contextRows = (await db.execute(sql`
    SELECT source_type, title, content
      FROM copilot_rag_source
     WHERE org_id = ${ctx.orgId}::uuid
       AND (
         content ILIKE ${"%" + body.data.content.slice(0, 80) + "%"}
         OR title ILIKE ${"%" + body.data.content.slice(0, 80) + "%"}
       )
     ORDER BY last_indexed_at DESC
     LIMIT 12
  `)) as unknown as Array<{
    source_type: string;
    title: string;
    content: string;
  }>;

  const history = await db
    .select({ role: copilotMessage.role, content: copilotMessage.content })
    .from(copilotMessage)
    .where(
      and(
        eq(copilotMessage.conversationId, id),
        eq(copilotMessage.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(copilotMessage.createdAt))
    .limit(20);

  let ai;
  try {
    ai = await aiCompleteGoverned({
      feature: "copilot.chat",
      orgId: ctx.orgId,
      userId: ctx.userId,
      // Copilot-Fragen betreffen regelmässig benannte Personen
      // (Verantwortliche, Melder, Prüfer).
      containsPersonalData: true,
      messages: buildCopilotPrompt({
        question: body.data.content,
        history: history.map((h) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content,
        })),
        context: contextRows.map((r) => ({
          sourceType: r.source_type,
          title: r.title,
          content: r.content,
        })),
      }),
      maxTokens: 2000,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: copilotAnswerSchema,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [userMsg] = await tx
      .insert(copilotMessage)
      .values({
        conversationId: id,
        orgId: ctx.orgId,
        role: "user",
        content: body.data.content,
        contentType: "text",
        templateKey: body.data.templateKey,
      })
      .returning();

    const inputTokens = ai.usage?.inputTokens ?? 0;
    const outputTokens = ai.usage?.outputTokens ?? 0;

    const [assistantMsg] = await tx
      .insert(copilotMessage)
      .values({
        conversationId: id,
        orgId: ctx.orgId,
        role: "assistant",
        content: ai.data.answer,
        // [S05-21] bewusst "text": es gibt keinen Markdown-Renderer im
        // Produkt. Wer einen einführt, muss zuerst sanitizen.
        contentType: "text",
        model: ai.model,
        inputTokens,
        outputTokens,
        latencyMs: ai.latencyMs,
        ragSources: ai.data.usedSources,
        templateKey: body.data.templateKey,
        metadata: {
          provider: ai.provider,
          confidence: ai.data.confidence,
          aiDisclosure: ai.disclosure,
        },
      })
      .returning();

    await tx
      .update(copilotConversation)
      .set({
        messageCount: sql`${copilotConversation.messageCount} + 2`,
        totalTokensUsed: sql`${copilotConversation.totalTokensUsed} + ${inputTokens + outputTokens}`,
        lastMessageAt: new Date(),
        title: conv.title ?? body.data.content.substring(0, 100),
        updatedAt: new Date(),
      })
      .where(eq(copilotConversation.id, id));

    return {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      aiDisclosure: ai.disclosure,
    };
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/copilot/conversations/:id/messages — List messages
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const url = new URL(req.url);
  const query = messageQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, before } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(copilotMessage.conversationId, id),
    eq(copilotMessage.orgId, ctx.orgId),
  ];

  if (before) conditions.push(lt(copilotMessage.createdAt, new Date(before)));

  const messages = await db
    .select()
    .from(copilotMessage)
    .where(and(...conditions))
    .orderBy(desc(copilotMessage.createdAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: messages });
}
