import { db, architectureRelationship, architectureElement } from "@grc/db";
import { createArchRelationshipSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/eam/relationships — Create relationship
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createArchRelationshipSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify both elements exist and belong to same org
  const [source] = await db
    .select({ id: architectureElement.id, orgId: architectureElement.orgId })
    .from(architectureElement)
    .where(eq(architectureElement.id, body.data.sourceId));

  const [target] = await db
    .select({ id: architectureElement.id, orgId: architectureElement.orgId })
    .from(architectureElement)
    .where(eq(architectureElement.id, body.data.targetId));

  if (!source || !target) {
    return Response.json(
      { error: "Source or target element not found" },
      { status: 404 },
    );
  }

  if (source.orgId !== ctx.orgId || target.orgId !== ctx.orgId) {
    return Response.json(
      { error: "Cross-org relationships not allowed" },
      { status: 403 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(architectureRelationship)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
