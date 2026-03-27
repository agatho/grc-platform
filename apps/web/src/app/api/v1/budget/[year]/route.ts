import { db, grcBudget, grcBudgetLine } from "@grc/db";
import { updateBudgetSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

function parseYear(params: { year: string }): number | null {
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2099) return null;
  return year;
}

// GET /api/v1/budget/:year — Budget detail with lines
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = parseYear({ year: yearStr });
  if (!year) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [budget] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)));

  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  const lines = await db
    .select()
    .from(grcBudgetLine)
    .where(eq(grcBudgetLine.budgetId, budget.id));

  return Response.json({ data: { ...budget, lines } });
}

// PUT /api/v1/budget/:year — Update budget
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = parseYear({ year: yearStr });
  if (!year) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const body = updateBudgetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)));

  if (!existing) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  // Prevent update of approved budget (except status transitions)
  if (existing.status === "approved" && body.data.status !== "draft") {
    return Response.json(
      { error: "Cannot modify an approved budget" },
      { status: 409 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.totalAmount !== undefined) values.totalAmount = body.data.totalAmount.toString();
    if (body.data.currency !== undefined) values.currency = body.data.currency;
    if (body.data.status !== undefined) values.status = body.data.status;
    if (body.data.notes !== undefined) values.notes = body.data.notes;

    const [row] = await tx
      .update(grcBudget)
      .set(values)
      .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
