import { db, orgRiskMethodology } from "@grc/db";
import { setMethodologySchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/[id]/risk-methodology — Get org methodology config
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  // Ensure user is in this org
  if (orgId !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [methodology] = await db
    .select()
    .from(orgRiskMethodology)
    .where(eq(orgRiskMethodology.orgId, orgId));

  if (!methodology) {
    // Return defaults
    return Response.json({
      data: {
        orgId,
        methodology: "iso_31000",
        matrixSize: 5,
        fairCurrency: "EUR",
        fairSimulationRuns: 10000,
        riskAppetiteThreshold: null,
        customLabelsJson: null,
      },
    });
  }

  return Response.json({ data: methodology });
}

// PUT /api/v1/organizations/[id]/risk-methodology — Set org methodology config
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  if (orgId !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = setMethodologySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Upsert: check if exists
    const [existing] = await tx
      .select({ id: orgRiskMethodology.id })
      .from(orgRiskMethodology)
      .where(eq(orgRiskMethodology.orgId, orgId));

    if (existing) {
      const [updated] = await tx
        .update(orgRiskMethodology)
        .set({
          ...body.data,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(orgRiskMethodology.orgId, orgId))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(orgRiskMethodology)
      .values({
        orgId,
        ...body.data,
        updatedBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result });
}
