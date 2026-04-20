import {
  db,
  copilotConversation,
  copilotMessage,
  copilotFeedback,
} from "@grc/db";
import { copilotUsageQuerySchema } from "@grc/shared";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/copilot/usage — Copilot usage statistics
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = copilotUsageQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const convConditions = [eq(copilotConversation.orgId, ctx.orgId)];

  const [convStats] = await db
    .select({
      totalConversations: sql<number>`count(*)`,
      uniqueUsers: sql<number>`count(distinct ${copilotConversation.userId})`,
      totalMessages: sql<number>`coalesce(sum(${copilotConversation.messageCount}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${copilotConversation.totalTokensUsed}), 0)`,
      activeConversations7d: sql<number>`count(*) filter (where ${copilotConversation.lastMessageAt} > now() - interval '7 days')`,
    })
    .from(copilotConversation)
    .where(and(...convConditions));

  const [feedbackStats] = await db
    .select({
      positive: sql<number>`count(*) filter (where ${copilotFeedback.rating} > 0)`,
      negative: sql<number>`count(*) filter (where ${copilotFeedback.rating} < 0)`,
      total: sql<number>`count(*)`,
    })
    .from(copilotFeedback)
    .where(eq(copilotFeedback.orgId, ctx.orgId));

  return Response.json({
    data: {
      ...convStats,
      feedback: feedbackStats,
    },
  });
}
