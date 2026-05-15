// GET    /api/v1/asset-classification-overrides/[id]   — single read
// DELETE /api/v1/asset-classification-overrides/[id]   — operator
//   revocation. Differs from /reject (which is the approver action):
//   the override creator (or any admin) can revoke at any time, no
//   4-eyes guard. Marks status='revoked' rather than hard-deleting so
//   the audit-trail keeps the record.

import { db, assetClassificationOverride } from "@grc/db";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select()
    .from(assetClassificationOverride)
    .where(
      and(
        eq(assetClassificationOverride.id, id),
        eq(assetClassificationOverride.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Override not found" }, { status: 404 });
  }
  return Response.json({ data: row });
});

const revokeSchema = z.object({
  revocationReason: z
    .string()
    .min(20, "revocation reason must be at least 20 characters"),
});

export const DELETE = withErrorHandler<RouteParams>(async function DELETE(
  req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth("admin", "risk_manager", "ciso", "control_owner");
  if (ctx instanceof Response) return ctx;

  const body = revokeSchema.safeParse(await req.json().catch(() => ({})));
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

  if (existing.status === "revoked") {
    return Response.json(
      {
        error: "Override is already revoked — re-revoking is a no-op.",
      },
      { status: 422 },
    );
  }

  // Revoke is creator-or-admin. Other authorized roles get a softer
  // 403 explaining why (rather than the catch-all from withAuth).
  const isAdminOrSelf =
    existing.createdBy === ctx.userId ||
    !!ctx.session.user.roles?.some(
      (r) => r.orgId === ctx.orgId && r.role === "admin",
    );
  if (!isAdminOrSelf) {
    return Response.json(
      {
        error:
          "Only the override creator or an admin can revoke. Use /reject if you're an approver declining a pending request.",
      },
      { status: 403 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(assetClassificationOverride)
      .set({
        status: "revoked",
        revokedBy: ctx.userId,
        revokedAt: new Date(),
        revocationReason: body.data.revocationReason,
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
