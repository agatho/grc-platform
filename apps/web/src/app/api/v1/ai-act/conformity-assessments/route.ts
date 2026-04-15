import { db, aiConformityAssessment } from "@grc/db";
import { createAiConformityAssessmentSchema, aiConformityQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const body = createAiConformityAssessmentSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(aiConformityAssessment).values({ ...body.data, orgId: ctx.orgId }).returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = aiConformityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });

  const { page, limit, aiSystemId, overallResult, status } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(aiConformityAssessment.orgId, ctx.orgId)];
  if (aiSystemId) conditions.push(eq(aiConformityAssessment.aiSystemId, aiSystemId));
  if (overallResult) conditions.push(eq(aiConformityAssessment.overallResult, overallResult));
  if (status) conditions.push(eq(aiConformityAssessment.status, status));

  const [rows, countResult] = await Promise.all([
    db.select().from(aiConformityAssessment).where(and(...conditions)).orderBy(desc(aiConformityAssessment.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(aiConformityAssessment).where(and(...conditions)),
  ]);
  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
