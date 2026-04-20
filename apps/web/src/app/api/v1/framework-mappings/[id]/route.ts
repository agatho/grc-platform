import { db, frameworkMapping } from "@grc/db";
import { updateFrameworkMappingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(frameworkMapping)
    .where(eq(frameworkMapping.id, id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.relationshipType)
    updateData.relationshipType = body.data.relationshipType;
  if (body.data.confidence !== undefined)
    updateData.confidence = String(body.data.confidence);
  if (body.data.rationale !== undefined)
    updateData.rationale = body.data.rationale;
  if (body.data.isVerified !== undefined) {
    updateData.isVerified = body.data.isVerified;
    if (body.data.isVerified) {
      updateData.verifiedBy = ctx.userId;
      updateData.verifiedAt = new Date();
    }
  }

  const [updated] = await db
    .update(frameworkMapping)
    .set(updateData)
    .where(eq(frameworkMapping.id, id))
    .returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
}
