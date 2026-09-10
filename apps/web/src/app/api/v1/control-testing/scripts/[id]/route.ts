import { db, controlTestScript } from "@grc/db";
import { updateTestScriptSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/control-testing/scripts/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [script] = await db
    .select()
    .from(controlTestScript)
    .where(
      and(eq(controlTestScript.id, id), eq(controlTestScript.orgId, ctx.orgId)),
    );

  if (!script) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: script });
});
// PATCH /api/v1/control-testing/scripts/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "control_owner");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateTestScriptSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(controlTestScript)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(controlTestScript.id, id),
          eq(controlTestScript.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
// DELETE /api/v1/control-testing/scripts/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "control_owner");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(controlTestScript)
      .where(
        and(
          eq(controlTestScript.id, id),
          eq(controlTestScript.orgId, ctx.orgId),
        ),
      )
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
});
