import { db, grcBudget } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/budget/:year/approve — Approve budget
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year < 2020 || year > 2099) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [budget] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)));

  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  if (budget.status === "approved") {
    return Response.json(
      { error: "Budget is already approved" },
      { status: 409 },
    );
  }

  // Budget must be submitted before approval
  if (budget.status === "draft") {
    return Response.json(
      { error: "Budget must be submitted before approval" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(grcBudget)
      .set({
        status: "approved",
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
