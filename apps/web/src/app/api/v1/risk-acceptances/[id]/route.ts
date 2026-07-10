// /api/v1/risk-acceptances/[id] — detail + limited update.
//
//   GET   — full acceptance record incl. risk title and acceptor/revoker
//           identity (review cockpit drill-down).
//   PATCH — adjust conditions / time-bound validity / tags of an ACTIVE
//           acceptance. Score snapshot, justification and status are
//           immutable audit artefacts: status changes only via the revoke
//           route (PATCH /risks/:id/acceptance/:acceptanceId/revoke) or
//           the `risk-acceptance-expiry` worker cron.
//
// No DELETE: acceptance rows are append-only governance records (ISO 27005
// Clause 10) — the table intentionally has no deleted_at column.

import { db, risk, riskAcceptance, user } from "@grc/db";
import { updateRiskAcceptanceSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/risk-acceptances/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "process_owner",
    "ciso",
    "control_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const acceptor = alias(user, "acceptor");
  const revoker = alias(user, "revoker");

  const [row] = await db
    .select({
      id: riskAcceptance.id,
      orgId: riskAcceptance.orgId,
      riskId: riskAcceptance.riskId,
      riskTitle: risk.title,
      riskStatus: risk.status,
      status: riskAcceptance.status,
      acceptedAt: riskAcceptance.acceptedAt,
      acceptedBy: riskAcceptance.acceptedBy,
      acceptedByName: acceptor.name,
      acceptedByEmail: acceptor.email,
      riskScoreAtAcceptance: riskAcceptance.riskScoreAtAcceptance,
      riskLevelAtAcceptance: riskAcceptance.riskLevelAtAcceptance,
      justification: riskAcceptance.justification,
      acceptanceConditions: riskAcceptance.acceptanceConditions,
      validUntil: riskAcceptance.validUntil,
      revokedAt: riskAcceptance.revokedAt,
      revokedBy: riskAcceptance.revokedBy,
      revokedByName: revoker.name,
      revokeReason: riskAcceptance.revokeReason,
      tags: riskAcceptance.tags,
      createdAt: riskAcceptance.createdAt,
      updatedAt: riskAcceptance.updatedAt,
    })
    .from(riskAcceptance)
    .leftJoin(risk, eq(risk.id, riskAcceptance.riskId))
    .leftJoin(acceptor, eq(acceptor.id, riskAcceptance.acceptedBy))
    .leftJoin(revoker, eq(revoker.id, riskAcceptance.revokedBy))
    .where(
      and(eq(riskAcceptance.id, id), eq(riskAcceptance.orgId, ctx.orgId)),
    );

  if (!row) {
    return Response.json(
      { error: "Acceptance record not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: row });
}

// PATCH /api/v1/risk-acceptances/:id — update conditions / validity.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "ciso");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateRiskAcceptanceSchema.safeParse(
    await req.json().catch(() => ({})),
  );
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
      and(eq(riskAcceptance.id, id), eq(riskAcceptance.orgId, ctx.orgId)),
    );

  if (!existing) {
    return Response.json(
      { error: "Acceptance record not found" },
      { status: 404 },
    );
  }

  if (existing.status !== "active") {
    return Response.json(
      {
        error: `Only active acceptances can be updated (status: ${existing.status}). Expired/revoked records are immutable audit artefacts.`,
      },
      { status: 409 },
    );
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [updated] = await tx
        .update(riskAcceptance)
        .set({
          ...(body.data.acceptanceConditions !== undefined
            ? { acceptanceConditions: body.data.acceptanceConditions }
            : {}),
          ...(body.data.validUntil !== undefined
            ? { validUntil: body.data.validUntil }
            : {}),
          ...(body.data.tags !== undefined ? { tags: body.data.tags } : {}),
          updatedAt: new Date(),
        })
        .where(eq(riskAcceptance.id, id))
        .returning();
      return updated;
    },
    {
      actionDetail: `Updated risk-acceptance ${id} (conditions/validity)`,
    },
  );

  return Response.json({ data: result });
}
