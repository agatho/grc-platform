import { db, regulatoryChange } from "@grc/db";
import { regulatoryChangeQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/regulatory-changes/changes — List regulatory changes
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor", "control_owner");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = regulatoryChangeQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, classification, changeType, status, jurisdiction, since } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(regulatoryChange.orgId, ctx.orgId)];
  if (classification) conditions.push(eq(regulatoryChange.classification, classification));
  if (changeType) conditions.push(eq(regulatoryChange.changeType, changeType));
  if (status) conditions.push(eq(regulatoryChange.status, status));
  if (jurisdiction) conditions.push(eq(regulatoryChange.jurisdiction, jurisdiction));
  if (since) conditions.push(gte(regulatoryChange.publishedAt, new Date(since)));

  const [changes, countResult] = await Promise.all([
    db.select().from(regulatoryChange)
      .where(and(...conditions))
      .orderBy(desc(regulatoryChange.publishedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(regulatoryChange)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: changes,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
