import { db, contract, contractObligation, user } from "@grc/db";
import { createObligationSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/contracts/:id/obligations — Create obligation
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify contract
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

  const body = createObligationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(contractObligation)
      .values({
        contractId: id,
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        obligationType: body.data.obligationType,
        dueDate: body.data.dueDate,
        recurring: body.data.recurring,
        recurringIntervalMonths: body.data.recurringIntervalMonths,
        responsibleId: body.data.responsibleId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/contracts/:id/obligations — List obligations
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
    .select({
      id: contractObligation.id,
      contractId: contractObligation.contractId,
      orgId: contractObligation.orgId,
      title: contractObligation.title,
      description: contractObligation.description,
      obligationType: contractObligation.obligationType,
      dueDate: contractObligation.dueDate,
      recurring: contractObligation.recurring,
      recurringIntervalMonths: contractObligation.recurringIntervalMonths,
      status: contractObligation.status,
      responsibleId: contractObligation.responsibleId,
      responsibleName: user.name,
      completedAt: contractObligation.completedAt,
      createdAt: contractObligation.createdAt,
      updatedAt: contractObligation.updatedAt,
    })
    .from(contractObligation)
    .leftJoin(user, eq(contractObligation.responsibleId, user.id))
    .where(
      and(
        eq(contractObligation.contractId, id),
        eq(contractObligation.orgId, ctx.orgId),
      ),
    )
    .orderBy(contractObligation.dueDate);

  return Response.json({ data: rows });
}
