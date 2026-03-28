import { db, controlTestLearning } from "@grc/db";
import { learningQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/control-testing/learning — List learning patterns
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = learningQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, controlId, patternType } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestLearning.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestLearning.controlId, controlId));
  if (patternType) conditions.push(eq(controlTestLearning.patternType, patternType));

  const [patterns, countResult] = await Promise.all([
    db.select().from(controlTestLearning)
      .where(and(...conditions))
      .orderBy(desc(controlTestLearning.updatedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(controlTestLearning)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: patterns,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
