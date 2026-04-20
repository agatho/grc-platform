import { db, contract } from "@grc/db";
import {
  contractStatusTransitionSchema,
  VALID_CONTRACT_TRANSITIONS,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/contracts/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = contractStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [current] = await db
    .select({ status: contract.status })
    .from(contract)
    .where(
      and(
        eq(contract.id, id),
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
      ),
    );

  if (!current) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const validTransitions = VALID_CONTRACT_TRANSITIONS[current.status] ?? [];
  if (!validTransitions.includes(body.data.status)) {
    return Response.json(
      {
        error: `Invalid transition from '${current.status}' to '${body.data.status}'`,
        validTransitions,
      },
      { status: 422 },
    );
  }

  const signedFields: Record<string, unknown> = {};
  if (body.data.status === "active" && current.status === "pending_approval") {
    signedFields.signedDate = new Date().toISOString().split("T")[0];
    signedFields.signedBy = ctx.userId;
  }

  const [updated] = await withAuditContext(ctx, async (tx) =>
    tx
      .update(contract)
      .set({
        status: body.data.status,
        ...signedFields,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(contract.id, id), eq(contract.orgId, ctx.orgId)))
      .returning(),
  );

  return Response.json({ data: updated });
}
