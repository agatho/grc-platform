import { db, rcsaAssignment, rcsaCampaign, user } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id/completion — Who hasn't submitted yet?
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Aggregate per user
  const perUser = await db
    .select({
      userId: rcsaAssignment.userId,
      assignedCount: sql<number>`count(*)`,
      completedCount: sql<number>`count(*) filter (where ${rcsaAssignment.status} = 'submitted')`,
      overdueCount: sql<number>`count(*) filter (where ${rcsaAssignment.status} = 'overdue')`,
      lastActivity: sql<string>`max(${rcsaAssignment.updatedAt})`,
    })
    .from(rcsaAssignment)
    .where(eq(rcsaAssignment.campaignId, id))
    .groupBy(rcsaAssignment.userId);

  // Enrich with user details
  const enriched = await Promise.all(
    perUser.map(async (row) => {
      const [u] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, row.userId));

      return {
        userId: row.userId,
        userName: u?.name ?? "",
        userEmail: u?.email ?? "",
        assignedCount: Number(row.assignedCount),
        completedCount: Number(row.completedCount),
        overdueCount: Number(row.overdueCount),
        lastActivity: row.lastActivity,
      };
    }),
  );

  // Sort: overdue first, then by completion (ascending)
  enriched.sort((a, b) => {
    if (a.overdueCount !== b.overdueCount)
      return b.overdueCount - a.overdueCount;
    return a.completedCount - b.completedCount;
  });

  return Response.json({ data: enriched });
}
