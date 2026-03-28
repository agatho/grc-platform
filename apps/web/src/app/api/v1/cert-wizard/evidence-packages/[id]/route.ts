import { db, certEvidencePackage } from "@grc/db";
import { updateCertEvidencePackageSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(certEvidencePackage).where(and(eq(certEvidencePackage.id, id), eq(certEvidencePackage.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateCertEvidencePackageSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const updateData: Record<string, unknown> = { ...body.data, updatedAt: new Date() };
  if (body.data.evidenceItems) {
    const items = body.data.evidenceItems;
    updateData.completeness = items.length > 0 ? ((items.filter((i) => i.status === "approved").length / items.length) * 100).toFixed(2) : "0";
  }
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(certEvidencePackage).set(updateData).where(and(eq(certEvidencePackage.id, id), eq(certEvidencePackage.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
