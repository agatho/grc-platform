import { db, evidenceReviewGap } from "@grc/db";
import { evidenceReviewGapQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/evidence-review/jobs/:id/gaps — List gaps for job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const url = new URL(req.url);
  const query = evidenceReviewGapQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, severity, status, gapType } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(evidenceReviewGap.jobId, id),
    eq(evidenceReviewGap.orgId, ctx.orgId),
  ];

  if (severity) conditions.push(eq(evidenceReviewGap.severity, severity));
  if (status) conditions.push(eq(evidenceReviewGap.status, status));
  if (gapType) conditions.push(eq(evidenceReviewGap.gapType, gapType));

  const [gaps, countResult] = await Promise.all([
    db
      .select()
      .from(evidenceReviewGap)
      .where(and(...conditions))
      .orderBy(desc(evidenceReviewGap.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(evidenceReviewGap)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: gaps,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
