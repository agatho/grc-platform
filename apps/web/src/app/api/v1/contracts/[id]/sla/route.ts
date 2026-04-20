import { db, contract, contractSla } from "@grc/db";
import { createSlaSchema, updateSlaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/contracts/:id/sla — Create SLA definition
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [c] = await db
    .select({ id: contract.id })
    .from(contract)
    .where(
      and(
        eq(contract.id, id),
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
      ),
    );
  if (!c) {
    return Response.json({ error: "Contract not found" }, { status: 404 });
  }

  const body = createSlaSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(contractSla)
      .values({
        contractId: id,
        orgId: ctx.orgId,
        metricName: body.data.metricName,
        targetValue: body.data.targetValue,
        unit: body.data.unit,
        measurementFrequency: body.data.measurementFrequency,
        penaltyClause: body.data.penaltyClause,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/contracts/:id/sla — List SLAs
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(contractSla)
    .where(
      and(eq(contractSla.contractId, id), eq(contractSla.orgId, ctx.orgId)),
    );

  return Response.json({ data: rows });
}
