import { db, agentRecommendation } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/agents/recommendations — All pending recommendations
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const severity = url.searchParams.get("severity");
  const agentId = url.searchParams.get("agentId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const conditions = [eq(agentRecommendation.orgId, ctx.orgId)];
  if (status) conditions.push(eq(agentRecommendation.status, status));
  if (severity) conditions.push(eq(agentRecommendation.severity, severity));
  if (agentId) conditions.push(eq(agentRecommendation.agentId, agentId));

  const recs = await db
    .select()
    .from(agentRecommendation)
    .where(and(...conditions))
    .orderBy(desc(agentRecommendation.createdAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: recs });
}
