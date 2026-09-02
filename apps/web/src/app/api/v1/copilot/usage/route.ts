import {
  db,
  copilotConversation,
  copilotMessage,
  copilotFeedback,
} from "@grc/db";
import { copilotUsageQuerySchema } from "@grc/shared";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/copilot/usage — Copilot usage statistics
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
