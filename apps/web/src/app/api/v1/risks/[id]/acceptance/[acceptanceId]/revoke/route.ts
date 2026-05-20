// PATCH /api/v1/risks/:id/acceptance/:acceptanceId/revoke
//
// Revoke a previously-recorded risk acceptance. The revoke flow does NOT
// run authority enforcement — the audit chain demands that revocations
// stay possible even if the matrix changes after acceptance. Anyone with
// risk-management write rights can revoke; the risk itself is moved back
// to status=identified so it re-enters the assessment lane.

import { db, risk, riskAcceptance } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const revokeSchema = z.object({
  reason: z.string().min(10).max(2000),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; acceptanceId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "ciso");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId, acceptanceId } = await params;

  const body = revokeSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(riskAcceptance)
    .where(
      and(
        eq(riskAcceptance.id, acceptanceId),
        eq(riskAcceptance.riskId, riskId),
        eq(riskAcceptance.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json(
      { error: "Acceptance record not found" },
      { status: 404 },
    );
  }

  if (existing.revokedAt) {
    return Response.json(
      { error: "Acceptance already revoked", revokedAt: existing.revokedAt },
      { status: 409 },
    );
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [revoked] = await tx
        .update(riskAcceptance)
        .set({
          revokedAt: new Date(),
          revokedBy: ctx.userId,
          revokeReason: body.data.reason,
          updatedAt: new Date(),
        })
        .where(eq(riskAcceptance.id, acceptanceId))
        .returning();

      // Pull the risk back into the assessment lane. Without this the
      // risk would stay in status=accepted even though there is no
      // active acceptance row — a contradictory state the rest of the
      // app would treat as still accepted.
      await tx
        .update(risk)
        .set({
          status: "identified",
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(risk.id, riskId), isNull(risk.deletedAt)));

      return revoked;
    },
    {
      actionDetail: `Revoked acceptance ${acceptanceId} for risk ${riskId}`,
      reason: body.data.reason,
    },
  );

  return Response.json({ data: result });
}
