import { db, grcBudget, grcBudgetLine } from "@grc/db";
import { createBudgetLineSchema, bulkCreateBudgetLinesSchema } from "@grc/shared";
import { eq, and, count } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

function parseYear(year: string): number | null {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2020 || y > 2099) return null;
  return y;
}

async function getBudget(orgId: string, year: number) {
  const [budget] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, orgId), eq(grcBudget.year, year)));
  return budget;
}

// POST /api/v1/budget/:year/lines — Add budget line(s)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = parseYear(yearStr);
  if (!year) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const budget = await getBudget(ctx.orgId, year);
  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  if (budget.status === "approved") {
    return Response.json(
      { error: "Cannot add lines to an approved budget" },
      { status: 409 },
    );
  }

  const rawBody = await req.json();

  // Support both single line and bulk lines
  const isBulk = rawBody.lines !== undefined;
  const parsed = isBulk
    ? bulkCreateBudgetLinesSchema.safeParse(rawBody)
    : createBudgetLineSchema.safeParse(rawBody);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const linesToCreate = isBulk
    ? (parsed.data as { lines: Array<Record<string, unknown>> }).lines
    : [parsed.data];

  const created = await withAuditContext(ctx, async (tx) => {
    const values = (linesToCreate as Array<Record<string, unknown>>).map((line) => ({
      orgId: ctx.orgId,
      budgetId: budget.id,
      grcArea: line.grcArea as string,
      costCategory: line.costCategory as string,
      plannedAmount: String(line.plannedAmount),
      q1Amount: line.q1Amount != null ? String(line.q1Amount) : undefined,
      q2Amount: line.q2Amount != null ? String(line.q2Amount) : undefined,
      q3Amount: line.q3Amount != null ? String(line.q3Amount) : undefined,
      q4Amount: line.q4Amount != null ? String(line.q4Amount) : undefined,
      notes: (line.notes as string) ?? undefined,
    }));

    const rows = await tx
      .insert(grcBudgetLine)
      .values(values)
      .returning();
    return rows;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/budget/:year/lines — List budget lines
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = parseYear(yearStr);
  if (!year) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const budget = await getBudget(ctx.orgId, year);
  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = eq(grcBudgetLine.budgetId, budget.id);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(grcBudgetLine)
      .where(conditions)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcBudgetLine).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
