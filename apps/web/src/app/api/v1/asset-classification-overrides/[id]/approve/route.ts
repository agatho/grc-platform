// POST /api/v1/asset-classification-overrides/[id]/approve
//
// #WAVE21-MAR-P2-03: Strict-path completion. Operator created the
// override with `requestApproval: true` → row sat in 'pending_approval'.
// An approver (admin / risk_manager / ciso) clicks /approve and the
// override flips to 'active'-equivalent ('approved' status keeps it
// distinguishable from a Light-path override in the audit log).
//
// 4-Eyes guard: rejects if the approver is the same user who created
// the override.

import { db, assetClassificationOverride } from "@grc/db";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

const approveSchema = z.object({
  approvalNotes: z.string().optional(),
});

export const POST = withErrorHandler<RouteParams>(async function POST(
  req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth("admin", "risk_manager", "ciso");
  if (ctx instanceof Response) return ctx;

  const body = approveSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(assetClassificationOverride)
    .where(
      and(
        eq(assetClassificationOverride.id, id),
        eq(assetClassificationOverride.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Override not found" }, { status: 404 });
  }

  if (existing.status !== "pending_approval") {
    return Response.json(
      {
        error: `Override is in '${existing.status}' state — only 'pending_approval' can be approved.`,
        currentStatus: existing.status,
      },
      { status: 422 },
    );
  }

  // 4-Eyes: same user can't approve their own override.
  if (existing.createdBy === ctx.userId) {
    return Response.json(
      {
        error:
          "Approver must be a different user from the override creator (4-eyes principle).",
      },
      { status: 403 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(assetClassificationOverride)
      .set({
        status: "approved",
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        approvalNotes: body.data.approvalNotes,
      })
      .where(
        and(
          eq(assetClassificationOverride.id, id),
          eq(assetClassificationOverride.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  return Response.json({ data: updated });
});
