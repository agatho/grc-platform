import { db, copilotConversation } from "@grc/db";
import { createConversationSchema, conversationQuerySchema } from "@grc/shared";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/copilot/conversations — Create new conversation
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const body = createConversationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(copilotConversation)
      .values({ ...body.data, orgId: ctx.orgId, userId: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/copilot/conversations — List user conversations
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = conversationQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, contextModule, isArchived, search } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(copilotConversation.orgId, ctx.orgId),
    eq(copilotConversation.userId, ctx.userId),
  ];

  if (contextModule) conditions.push(eq(copilotConversation.contextModule, contextModule));
  if (isArchived !== undefined) conditions.push(eq(copilotConversation.isArchived, isArchived));
  if (search) conditions.push(ilike(copilotConversation.title, `%${search}%`));

  const [conversations, countResult] = await Promise.all([
    db
      .select()
      .from(copilotConversation)
      .where(and(...conditions))
      .orderBy(desc(copilotConversation.lastMessageAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(copilotConversation)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: conversations,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
