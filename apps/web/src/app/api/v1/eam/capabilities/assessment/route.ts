import { db, businessCapability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateCapabilityAssessmentSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// PUT /api/v1/eam/capabilities/:id/assessment — Update coverage + alignment
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const capabilityId = url.searchParams.get("id");
  if (!capabilityId) return Response.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateCapabilityAssessmentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.update(businessCapability)
    .set(parsed.data)
    .where(and(eq(businessCapability.id, capabilityId), eq(businessCapability.orgId, ctx.orgId)))
    .returning();

  if (!updated.length) return Response.json({ error: "Capability not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
}
