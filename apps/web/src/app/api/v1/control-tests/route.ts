import { db, controlTest, control, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc, asc, inArray } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/control-tests — List control tests
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(controlTest.orgId, ctx.orgId),
    isNull(controlTest.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "planned" | "in_progress" | "completed" | "cancelled"
    >;
    conditions.push(inArray(controlTest.status, statuses));
  }

  // Campaign filter
  const campaignId = searchParams.get("campaignId");
  if (campaignId) {
    conditions.push(eq(controlTest.campaignId, campaignId));
  }

  // Control filter
  const controlId = searchParams.get("controlId");
  if (controlId) {
    conditions.push(eq(controlTest.controlId, controlId));
  }

  // Tester filter
  const testerId = searchParams.get("testerId");
  if (testerId) {
    conditions.push(eq(controlTest.testerId, testerId));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: controlTest.id,
        orgId: controlTest.orgId,
        controlId: controlTest.controlId,
        controlTitle: control.title,
        campaignId: controlTest.campaignId,
        taskId: controlTest.taskId,
        testType: controlTest.testType,
        status: controlTest.status,
        todResult: controlTest.todResult,
        toeResult: controlTest.toeResult,
        testerId: controlTest.testerId,
        testerName: user.name,
        testDate: controlTest.testDate,
        sampleSize: controlTest.sampleSize,
        createdAt: controlTest.createdAt,
        updatedAt: controlTest.updatedAt,
      })
      .from(controlTest)
      .innerJoin(control, eq(controlTest.controlId, control.id))
      .leftJoin(user, eq(controlTest.testerId, user.id))
      .where(where)
      .orderBy(sortDir(controlTest.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(controlTest).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
