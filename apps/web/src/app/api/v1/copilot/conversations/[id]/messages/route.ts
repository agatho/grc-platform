import { db, copilotConversation, copilotMessage } from "@grc/db";
import { sendMessageSchema, messageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, lt } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

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

  const result = await withAuditContext(ctx, async (tx) => {
    // Insert user message
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

    // Generate AI response (placeholder - integrates with Sprint 51 LLM infra)
    const aiResponseContent = `[AI Response] Processing query: "${body.data.content.substring(0, 100)}..."`;
    const inputTokens = Math.ceil(body.data.content.length / 4);
    const outputTokens = Math.ceil(aiResponseContent.length / 4);

    const [assistantMsg] = await tx
      .insert(copilotMessage)
      .values({
        conversationId: id,
        orgId: ctx.orgId,
        role: "assistant",
        content: aiResponseContent,
        contentType: "markdown",
        model: "default",
        inputTokens,
        outputTokens,
        latencyMs: 500,
        ragSources: [],
        templateKey: body.data.templateKey,
      })
      .returning();

    // Update conversation stats
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

    return { userMessage: userMsg, assistantMessage: assistantMsg };
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
