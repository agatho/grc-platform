import { db, agentRegistration, agentRecommendation } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/agents/dashboard — Agent overview
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const agents = await db
    .select()
    .from(agentRegistration)
    .where(eq(agentRegistration.orgId, ctx.orgId));

  const [recStats] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      critical: sql<number>`count(*) filter (where severity = 'critical' and status = 'pending')::int`,
    })
    .from(agentRecommendation)
    .where(eq(agentRecommendation.orgId, ctx.orgId));

  const activeAgents = agents.filter((a) => a.isActive).length;
  const lastScan = agents
    .filter((a) => a.lastRunAt)
    .sort(
      (a, b) =>
        new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime(),
    )[0]?.lastRunAt;

  return Response.json({
    data: {
      activeAgents,
      totalAgents: agents.length,
      lastScanAt: lastScan,
      pendingRecommendations: recStats?.pending ?? 0,
      criticalAlerts: recStats?.critical ?? 0,
      agents,
    },
  });
}
