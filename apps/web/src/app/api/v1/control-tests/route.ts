import { db, controlTest, control, user } from "@grc/db";
import { executeTestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc, asc, inArray } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import type { SQL } from "drizzle-orm";

// GET /api/v1/control-tests — List control tests
export const GET = withErrorHandler(async function GET(req: Request) {
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
});

// POST /api/v1/control-tests — Create a control test (ToD/ToE).
//
// #WAVE24-B4: previously 405. Wave-23 left this collection POST-less
// (only the nested `/controls/{id}/tests` route existed), so the
// compliance officer's "create test" workflow broke. RBAC mirrors the
// PUT handler in [id]/route.ts plus compliance_officer + auditor for
// 2nd/3rd-line test ownership. Body schema reuses executeTestSchema
// from @grc/shared so validation stays single-source-of-truth.
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "auditor",
    "control_owner",
    "compliance_officer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = executeTestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify the referenced control belongs to the caller's org. RLS
  // would also reject cross-tenant FKs, but checking up-front yields
  // a 422 with an explicit message instead of an opaque 500.
  const [parent] = await db
    .select({ id: control.id })
    .from(control)
    .where(
      and(
        eq(control.id, body.data.controlId),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );
  if (!parent) {
    return Response.json(
      { error: "Referenced control not found in this organization" },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const tod = body.data.todResult;
    const toe = body.data.toeResult;
    const status: "planned" | "in_progress" | "completed" =
      tod && toe ? "completed" : tod || toe ? "in_progress" : "planned";

    const [row] = await tx
      .insert(controlTest)
      .values({
        orgId: ctx.orgId,
        controlId: body.data.controlId,
        campaignId: body.data.campaignId,
        testType: body.data.testType,
        status,
        todResult: tod,
        toeResult: toe,
        testDate: body.data.testDate,
        sampleSize: body.data.sampleSize,
        sampleDescription: body.data.sampleDescription,
        conclusion: body.data.conclusion,
        testerId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
