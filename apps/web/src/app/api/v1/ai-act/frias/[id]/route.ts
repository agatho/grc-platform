import { db, aiFria } from "@grc/db";
import { updateAiFriaSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(aiFria)
    .where(and(eq(aiFria.id, id), eq(aiFria.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const { id } = await params;
  const body = updateAiFriaSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(aiFria)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(aiFria.id, id), eq(aiFria.orgId, ctx.orgId)))
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
