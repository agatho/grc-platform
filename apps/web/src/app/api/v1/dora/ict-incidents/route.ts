import { db, doraIctIncident } from "@grc/db";
import { createDoraIctIncidentSchema, doraIctIncidentQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createDoraIctIncidentSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const detectedAt = new Date(body.data.detectedAt);
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(doraIctIncident).values({
      ...body.data,
      orgId: ctx.orgId,
      detectedAt,
      // Auto-calculate DORA reporting deadlines: 4h, 72h, 1 month
      initialReportDue: new Date(detectedAt.getTime() + 4 * 60 * 60 * 1000),
      intermediateReportDue: new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000),
      finalReportDue: new Date(detectedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = doraIctIncidentQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });

  const { page, limit, classification, status, since } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(doraIctIncident.orgId, ctx.orgId)];
  if (classification) conditions.push(eq(doraIctIncident.classification, classification));
  if (status) conditions.push(eq(doraIctIncident.status, status));
  if (since) conditions.push(gte(doraIctIncident.detectedAt, new Date(since)));

  const [rows, countResult] = await Promise.all([
    db.select().from(doraIctIncident).where(and(...conditions)).orderBy(desc(doraIctIncident.detectedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(doraIctIncident).where(and(...conditions)),
  ]);

  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
