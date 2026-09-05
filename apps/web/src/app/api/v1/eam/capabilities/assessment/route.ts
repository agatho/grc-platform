import { db, businessCapability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateCapabilityAssessmentSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/eam/capabilities/:id/assessment — Update coverage + alignment
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const capabilityId = url.searchParams.get("id");
  if (!capabilityId)
    return Response.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateCapabilityAssessmentSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const updated = await db
    .update(businessCapability)
    .set(parsed.data)
    .where(
      and(
        eq(businessCapability.id, capabilityId),
        eq(businessCapability.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated.length)
    return Response.json({ error: "Capability not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
});
