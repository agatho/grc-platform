import { db, certReadinessAssessment } from "@grc/db";
import { updateCertReadinessSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(certReadinessAssessment).where(and(eq(certReadinessAssessment.id, id), eq(certReadinessAssessment.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateCertReadinessSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  // Auto-compute readiness score and counts
  const updateData: Record<string, unknown> = { ...body.data, updatedAt: new Date() };
  if (body.data.controlDetails) {
    const details = body.data.controlDetails;
    updateData.totalControls = details.length;
    updateData.implementedControls = details.filter((d) => d.status === "implemented").length;
    updateData.partialControls = details.filter((d) => d.status === "partial").length;
    updateData.notImplemented = details.filter((d) => d.status === "not_implemented").length;
    updateData.notApplicable = details.filter((d) => d.status === "not_applicable").length;
    const applicable = details.length - (updateData.notApplicable as number);
    updateData.readinessScore = applicable > 0
      ? (((updateData.implementedControls as number) + (updateData.partialControls as number) * 0.5) / applicable * 100).toFixed(2)
      : "0";
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(certReadinessAssessment).set(updateData).where(and(eq(certReadinessAssessment.id, id), eq(certReadinessAssessment.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx.delete(certReadinessAssessment).where(and(eq(certReadinessAssessment.id, id), eq(certReadinessAssessment.orgId, ctx.orgId))).returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
