import { db, evidenceReviewResult } from "@grc/db";
import { evidenceReviewResultQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/evidence-review/jobs/:id/results — List results for job
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
  const query = evidenceReviewResultQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, classification, controlId, minConfidence } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(evidenceReviewResult.jobId, id),
    eq(evidenceReviewResult.orgId, ctx.orgId),
  ];

  if (classification)
    conditions.push(eq(evidenceReviewResult.classification, classification));
  if (controlId) conditions.push(eq(evidenceReviewResult.controlId, controlId));
  if (minConfidence !== undefined)
    conditions.push(
      gte(evidenceReviewResult.confidenceScore, String(minConfidence)),
    );

  const [results, countResult] = await Promise.all([
    db
      .select()
      .from(evidenceReviewResult)
      .where(and(...conditions))
      .orderBy(desc(evidenceReviewResult.reviewedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(evidenceReviewResult)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: results,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
