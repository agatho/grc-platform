import { db, dataFlow } from "@grc/db";
import { createDataFlowSchema, updateDataFlowSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/eam/data-flows — Create data flow
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDataFlowSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(dataFlow)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/eam/data-flows — List data flows
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const personalOnly = url.searchParams.get("personalData") === "true";
  const crossBorder = url.searchParams.get("crossBorder") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);

  const conditions = [eq(dataFlow.orgId, ctx.orgId)];
  if (personalOnly) conditions.push(eq(dataFlow.containsPersonalData, true));
  if (crossBorder) conditions.push(eq(dataFlow.crossesEuBorder, true));

  const flows = await db
    .select()
    .from(dataFlow)
    .where(and(...conditions))
    .orderBy(desc(dataFlow.updatedAt))
    .limit(limit);

  return Response.json({ data: flows });
}
