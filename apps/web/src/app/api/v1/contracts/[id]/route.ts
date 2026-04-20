import {
  db,
  contract,
  workItem,
  user,
  vendor,
  contractObligation,
  contractSla,
  contractAmendment,
} from "@grc/db";
import { updateContractSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/contracts/:id — Contract detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: contract.id,
      orgId: contract.orgId,
      workItemId: contract.workItemId,
      elementId: workItem.elementId,
      vendorId: contract.vendorId,
      vendorName: vendor.name,
      title: contract.title,
      description: contract.description,
      contractType: contract.contractType,
      status: contract.status,
      contractNumber: contract.contractNumber,
      effectiveDate: contract.effectiveDate,
      expirationDate: contract.expirationDate,
      noticePeriodDays: contract.noticePeriodDays,
      autoRenewal: contract.autoRenewal,
      renewalPeriodMonths: contract.renewalPeriodMonths,
      totalValue: contract.totalValue,
      currency: contract.currency,
      annualValue: contract.annualValue,
      paymentTerms: contract.paymentTerms,
      documentId: contract.documentId,
      ownerId: contract.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      approverId: contract.approverId,
      signedDate: contract.signedDate,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      createdBy: contract.createdBy,
    })
    .from(contract)
    .leftJoin(workItem, eq(contract.workItemId, workItem.id))
    .leftJoin(vendor, eq(contract.vendorId, vendor.id))
    .leftJoin(user, eq(contract.ownerId, user.id))
    .where(
      and(
        eq(contract.id, id),
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Counts
  const [
    [{ value: obligationCount }],
    [{ value: slaCount }],
    [{ value: amendmentCount }],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(contractObligation)
      .where(eq(contractObligation.contractId, id)),
    db
      .select({ value: count() })
      .from(contractSla)
      .where(eq(contractSla.contractId, id)),
    db
      .select({ value: count() })
      .from(contractAmendment)
      .where(eq(contractAmendment.contractId, id)),
  ]);

  return Response.json({
    data: { ...row, obligationCount, slaCount, amendmentCount },
  });
}

// PUT /api/v1/contracts/:id — Update contract
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateContractSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(contract)
      .set({
        ...body.data,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contract.id, id),
          eq(contract.orgId, ctx.orgId),
          isNull(contract.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/contracts/:id — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(contract)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(contract.id, id),
          eq(contract.orgId, ctx.orgId),
          isNull(contract.deletedAt),
        ),
      )
      .returning({ id: contract.id });
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
