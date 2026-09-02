import { db, pbdAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { createPbdAssessmentSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/dpms/pbd-assessments — List PbD assessments
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(pbdAssessment.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(pbdAssessment)
      .where(where)
      .orderBy(desc(pbdAssessment.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(pbdAssessment).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
// POST /api/v1/dpms/pbd-assessments — Create PbD assessment
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createPbdAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx
      .insert(pbdAssessment)
      .values({
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        ...body.data,
      })
      .returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
});
