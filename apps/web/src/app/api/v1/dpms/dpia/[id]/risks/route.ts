import { db, dpia, dpiaRisk } from "@grc/db";
import { createDpiaRiskSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dpia/:id/risks — Add a risk to DPIA
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dpia)
    .where(
      and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "DPIA not found" }, { status: 404 });
  }

  const body = createDpiaRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(dpiaRisk)
      .values({
        orgId: ctx.orgId,
        dpiaId: id,
        riskDescription: body.data.riskDescription,
        severity: body.data.severity,
        likelihood: body.data.likelihood,
        impact: body.data.impact,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/dpia/:id/risks — List risks for a DPIA
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const risks = await db
    .select()
    .from(dpiaRisk)
    .where(and(eq(dpiaRisk.dpiaId, id), eq(dpiaRisk.orgId, ctx.orgId)));

  return Response.json({ data: risks });
}
