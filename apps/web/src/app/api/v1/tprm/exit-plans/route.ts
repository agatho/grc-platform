import { db, vendorExitPlan } from "@grc/db";
import { createExitPlanSchema, computeExitReadiness } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/tprm/exit-plans?vendorId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  const { limit, offset } = paginate(url.searchParams);
  const conditions = [eq(vendorExitPlan.orgId, ctx.orgId)];
  if (vendorId) conditions.push(eq(vendorExitPlan.vendorId, vendorId));

  const rows = await db.select().from(vendorExitPlan).where(and(...conditions)).orderBy(desc(vendorExitPlan.createdAt)).limit(limit).offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/tprm/exit-plans?vendorId=...
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  if (!vendorId) return Response.json({ error: "vendorId required" }, { status: 400 });

  const body = createExitPlanSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const exitReadinessScore = computeExitReadiness({
    hasExitPlan: true,
    exitPlanCurrent: true,
    alternativeIdentified: (body.data.alternativeVendorIds?.length ?? 0) > 0,
    dataPortabilityConfirmed: !!body.data.dataMigrationPlan,
    exitClauseAdequate: !!body.data.terminationNoticeDays,
  });

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.insert(vendorExitPlan).values({
      orgId: ctx.orgId,
      vendorId,
      ...body.data,
      estimatedCost: body.data.estimatedCost?.toString(),
      exitReadinessScore,
      createdBy: ctx.userId,
    }).returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
