import {
  db,
  risk,
  riskFrameworkMapping,
} from "@grc/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { z } from "zod";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

const createFrameworkMappingSchema = z.object({
  requirementId: z.string().uuid(),
});

// POST /api/v1/risks/:id/framework-mappings — Link risk to framework requirement
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = createFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check for duplicate mapping
  const [dup] = await db
    .select({ id: riskFrameworkMapping.id })
    .from(riskFrameworkMapping)
    .where(
      and(
        eq(riskFrameworkMapping.riskId, id),
        eq(riskFrameworkMapping.requirementId, body.data.requirementId),
        eq(riskFrameworkMapping.orgId, ctx.orgId),
      ),
    );

  if (dup) {
    return Response.json(
      { error: "This risk is already mapped to this requirement" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(riskFrameworkMapping)
      .values({
        orgId: ctx.orgId,
        riskId: id,
        requirementId: body.data.requirementId,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/risks/:id/framework-mappings — List framework mappings for risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(riskFrameworkMapping.riskId, id),
    eq(riskFrameworkMapping.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(riskFrameworkMapping)
      .where(conditions)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(riskFrameworkMapping)
      .where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
