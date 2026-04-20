import { db, biaSupplierDependency, biaProcessImpact } from "@grc/db";
import { createBiaSupplierDependencySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/bcms/bia/[id]/suppliers — Add supplier dependency
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: biaProcessImpactId } = await params;

  const body = createBiaSupplierDependencySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process impact exists
  const [impact] = await db
    .select({ id: biaProcessImpact.id })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.id, biaProcessImpactId),
        eq(biaProcessImpact.orgId, ctx.orgId),
      ),
    );

  if (!impact) {
    return Response.json(
      { error: "BIA process impact not found" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(biaSupplierDependency)
      .values({
        biaProcessImpactId,
        orgId: ctx.orgId,
        supplierName: body.data.supplierName,
        service: body.data.service,
        isCritical: body.data.isCritical,
        alternativeAvailable: body.data.alternativeAvailable,
        switchoverTimeHours: body.data.switchoverTimeHours,
        notes: body.data.notes,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/bia/[id]/suppliers — List supplier dependencies
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: biaProcessImpactId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(biaSupplierDependency.biaProcessImpactId, biaProcessImpactId),
    eq(biaSupplierDependency.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(biaSupplierDependency)
      .where(where)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(biaSupplierDependency).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
