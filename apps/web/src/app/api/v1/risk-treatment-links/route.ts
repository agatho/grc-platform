import { db, riskTreatmentLink, risk, riskTreatment } from "@grc/db";
import { createRiskTreatmentLinkSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/risk-treatment-links — Link treatment to risk
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRiskTreatmentLinkSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify risk belongs to org
  const [targetRisk] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(and(eq(risk.id, body.data.riskId), eq(risk.orgId, ctx.orgId)));

  if (!targetRisk) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Verify treatment belongs to org
  const [targetTreatment] = await db
    .select({ id: riskTreatment.id })
    .from(riskTreatment)
    .where(and(eq(riskTreatment.id, body.data.treatmentId), eq(riskTreatment.orgId, ctx.orgId)));

  if (!targetTreatment) {
    return Response.json({ error: "Treatment not found" }, { status: 404 });
  }

  const link = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskTreatmentLink)
      .values({
        riskId: body.data.riskId,
        treatmentId: body.data.treatmentId,
        orgId: ctx.orgId,
        linkedBy: ctx.userId,
      })
      .onConflictDoNothing()
      .returning();

    return created;
  });

  if (!link) {
    return Response.json({ error: "Link already exists" }, { status: 409 });
  }

  return Response.json({ data: link }, { status: 201 });
}

// GET /api/v1/risk-treatment-links — List links for org
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const riskId = url.searchParams.get("riskId");
  const treatmentId = url.searchParams.get("treatmentId");

  let query = db
    .select({
      id: riskTreatmentLink.id,
      riskId: riskTreatmentLink.riskId,
      riskTitle: risk.title,
      treatmentId: riskTreatmentLink.treatmentId,
      treatmentTitle: riskTreatment.description,
      linkedAt: riskTreatmentLink.linkedAt,
    })
    .from(riskTreatmentLink)
    .leftJoin(risk, eq(riskTreatmentLink.riskId, risk.id))
    .leftJoin(riskTreatment, eq(riskTreatmentLink.treatmentId, riskTreatment.id))
    .where(eq(riskTreatmentLink.orgId, ctx.orgId))
    .$dynamic();

  if (riskId) {
    query = query.where(eq(riskTreatmentLink.riskId, riskId));
  }
  if (treatmentId) {
    query = query.where(eq(riskTreatmentLink.treatmentId, treatmentId));
  }

  const links = await query;

  return Response.json({ data: links });
}

// DELETE /api/v1/risk-treatment-links — Remove link
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const linkId = url.searchParams.get("id");
  if (!linkId) {
    return Response.json({ error: "Link ID required" }, { status: 400 });
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [result] = await tx
      .delete(riskTreatmentLink)
      .where(
        and(
          eq(riskTreatmentLink.id, linkId),
          eq(riskTreatmentLink.orgId, ctx.orgId),
        ),
      )
      .returning();
    return result;
  });

  if (!deleted) {
    return Response.json({ error: "Link not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
}
