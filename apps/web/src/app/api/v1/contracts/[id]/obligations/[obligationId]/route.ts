import { db, contract, contractObligation } from "@grc/db";
import { updateObligationSchema, obligationStatusTransitionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/contracts/:id/obligations/:obligationId — Update obligation
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; obligationId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, obligationId } = await params;

  // Verify contract
  const [c] = await db
    .select({ id: contract.id })
    .from(contract)
    .where(and(eq(contract.id, id), eq(contract.orgId, ctx.orgId), isNull(contract.deletedAt)));
  if (!c) {
    return Response.json({ error: "Contract not found" }, { status: 404 });
  }

  const rawBody = await req.json();

  // Check if status-only update
  if (rawBody.status && Object.keys(rawBody).length === 1) {
    const parsed = obligationStatusTransitionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const completedAt = parsed.data.status === "completed" ? new Date() : undefined;

    const [updated] = await withAuditContext(ctx, async (tx) =>
      tx
        .update(contractObligation)
        .set({
          status: parsed.data.status,
          ...(completedAt ? { completedAt } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contractObligation.id, obligationId),
            eq(contractObligation.contractId, id),
            eq(contractObligation.orgId, ctx.orgId),
          ),
        )
        .returning(),
    );

    if (!updated) {
      return Response.json({ error: "Obligation not found" }, { status: 404 });
    }

    return Response.json({ data: updated });
  }

  // Regular update
  const body = updateObligationSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await withAuditContext(ctx, async (tx) =>
    tx
      .update(contractObligation)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contractObligation.id, obligationId),
          eq(contractObligation.contractId, id),
          eq(contractObligation.orgId, ctx.orgId),
        ),
      )
      .returning(),
  );

  if (!updated) {
    return Response.json({ error: "Obligation not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
