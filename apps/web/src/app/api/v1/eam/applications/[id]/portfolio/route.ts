import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { applicationPortfolioSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/eam/applications/:id/portfolio
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [portfolio] = await db
    .select()
    .from(applicationPortfolio)
    .where(and(eq(applicationPortfolio.elementId, id), eq(applicationPortfolio.orgId, ctx.orgId)));

  return Response.json({ data: portfolio ?? null });
}

// PUT /api/v1/eam/applications/:id/portfolio — Update TIME assessment + lifecycle
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = applicationPortfolioSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Verify element is an application
  const [element] = await db
    .select({ type: architectureElement.type })
    .from(architectureElement)
    .where(and(eq(architectureElement.id, id), eq(architectureElement.orgId, ctx.orgId)));

  if (!element) {
    return Response.json({ error: "Element not found" }, { status: 404 });
  }
  if (element.type !== "application") {
    return Response.json({ error: "Portfolio data only for application type elements" }, { status: 400 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: applicationPortfolio.id })
      .from(applicationPortfolio)
      .where(eq(applicationPortfolio.elementId, id));

    if (existing) {
      const [updated] = await tx
        .update(applicationPortfolio)
        .set(body.data)
        .where(eq(applicationPortfolio.elementId, id))
        .returning();
      return updated;
    } else {
      const [created] = await tx
        .insert(applicationPortfolio)
        .values({ ...body.data, elementId: id, orgId: ctx.orgId })
        .returning();
      return created;
    }
  });

  return Response.json({ data: result });
}
