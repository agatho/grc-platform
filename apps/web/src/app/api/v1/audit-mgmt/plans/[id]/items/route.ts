import { db, auditPlanItem, auditPlan } from "@grc/db";
import { createAuditPlanItemSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/plans/[id]/items — Create plan item
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify plan belongs to org
  const [plan] = await db
    .select({ id: auditPlan.id })
    .from(auditPlan)
    .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)));

  if (!plan) {
    return Response.json({ error: "Audit plan not found" }, { status: 404 });
  }

  const body = createAuditPlanItemSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditPlanItem)
      .values({
        orgId: ctx.orgId,
        auditPlanId: id,
        universeEntryId: body.data.universeEntryId,
        title: body.data.title,
        scopeDescription: body.data.scopeDescription,
        plannedStart: body.data.plannedStart,
        plannedEnd: body.data.plannedEnd,
        estimatedDays: body.data.estimatedDays,
        leadAuditorId: body.data.leadAuditorId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/audit-mgmt/plans/[id]/items — List plan items
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: RouteParams,
) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(auditPlanItem.auditPlanId, id),
    eq(auditPlanItem.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditPlanItem)
      .where(where)
      .orderBy(desc(auditPlanItem.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditPlanItem).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
