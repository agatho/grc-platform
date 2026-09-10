import { db, identityConnectorConfig } from "@grc/db";
import { updateIdentityConnectorConfigSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/identity-connectors/configs/:id
export const GET = withErrorHandler(async function GET(
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
    .from(identityConnectorConfig)
    .where(
      and(
        eq(identityConnectorConfig.id, id),
        eq(identityConnectorConfig.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
// PATCH /api/v1/identity-connectors/configs/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateIdentityConnectorConfigSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(identityConnectorConfig)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(identityConnectorConfig.id, id),
          eq(identityConnectorConfig.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
});
// F#19 (overnight 2026-05-18): Identity connector configs had no DELETE
// handler. Hard delete (no soft-delete column on this table). Audit
// context still captures the deletion.
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const deleted = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .delete(identityConnectorConfig)
        .where(
          and(
            eq(identityConnectorConfig.id, id),
            eq(identityConnectorConfig.orgId, ctx.orgId),
          ),
        )
        .returning({ id: identityConnectorConfig.id });
      return row;
    },
    { actionDetail: `Deleted identity connector config ${id}` },
  );

  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
});
