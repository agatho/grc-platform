import { db, evidenceReviewJob } from "@grc/db";
import { createEvidenceReviewJobSchema, evidenceReviewJobQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/evidence-review/jobs — Create evidence review job
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createEvidenceReviewJobSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(evidenceReviewJob)
      .values({
        ...body.data,
        scopeFilter: body.data.scopeFilter ?? {},
        orgId: ctx.orgId,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/evidence-review/jobs — List jobs
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = evidenceReviewJobQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, status } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(evidenceReviewJob.orgId, ctx.orgId)];
  if (status) conditions.push(eq(evidenceReviewJob.status, status));

  const [jobs, countResult] = await Promise.all([
    db.select().from(evidenceReviewJob)
      .where(and(...conditions))
      .orderBy(desc(evidenceReviewJob.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(evidenceReviewJob)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: jobs,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
