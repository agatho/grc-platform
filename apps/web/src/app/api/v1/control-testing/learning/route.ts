import { db, controlTestLearning } from "@grc/db";
import { learningQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/control-testing/learning — List learning patterns
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = learningQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, controlId, patternType } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestLearning.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestLearning.controlId, controlId));
  if (patternType)
    conditions.push(eq(controlTestLearning.patternType, patternType));

  const [patterns, countResult] = await Promise.all([
    db
      .select()
      .from(controlTestLearning)
      .where(and(...conditions))
      .orderBy(desc(controlTestLearning.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(controlTestLearning)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: patterns,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
