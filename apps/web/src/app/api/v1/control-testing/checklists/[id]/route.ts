import { db, controlTestChecklist } from "@grc/db";
import { updateChecklistSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/control-testing/checklists/:id
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
  const [checklist] = await db
    .select()
    .from(controlTestChecklist)
    .where(
      and(
        eq(controlTestChecklist.id, id),
        eq(controlTestChecklist.orgId, ctx.orgId),
      ),
    );

  if (!checklist) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: checklist });
});
// PATCH /api/v1/control-testing/checklists/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateChecklistSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const completedItems =
    body.data.items?.filter((i) => i.response && i.response !== "na").length ??
    0;

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(controlTestChecklist)
      .set({
        ...body.data,
        completedItems,
        completedAt: body.data.status === "completed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(controlTestChecklist.id, id),
          eq(controlTestChecklist.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
