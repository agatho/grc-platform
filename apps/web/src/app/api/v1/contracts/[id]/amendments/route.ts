import { db, contract, contractAmendment } from "@grc/db";
import { createAmendmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/contracts/:id/amendments — Create amendment
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
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

  const body = createAmendmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(contractAmendment)
      .values({
        contractId: id,
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        effectiveDate: body.data.effectiveDate,
        documentId: body.data.documentId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/contracts/:id/amendments — List amendments
export const GET = withErrorHandler(async function GET(
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
    .from(contractAmendment)
    .where(
      and(
        eq(contractAmendment.contractId, id),
        eq(contractAmendment.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(contractAmendment.createdAt));

  return Response.json({ data: rows });
});
