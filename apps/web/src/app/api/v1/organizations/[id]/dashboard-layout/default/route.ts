import { userDashboardLayout } from "@grc/db";
import { setOrgDefaultLayoutSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/organizations/:id/dashboard-layout/default -- Set org default layout (admin only)
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  const rawBody = await req.json();
  const result = setOrgDefaultLayoutSchema.safeParse(rawBody);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const body = result.data;

  const saved = await withAuditContext(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(userDashboardLayout)
      .where(
        and(
          eq(userDashboardLayout.orgId, orgId),
          isNull(userDashboardLayout.userId),
          eq(userDashboardLayout.isDefault, true),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const [updated] = await tx
        .update(userDashboardLayout)
        .set({ layoutJson: body.layoutJson, updatedAt: new Date() })
        .where(eq(userDashboardLayout.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(userDashboardLayout)
      .values({
        orgId,
        userId: null,
        layoutJson: body.layoutJson,
        isDefault: true,
      })
      .returning();
    return created;
  });

  return Response.json({ data: saved });
});
