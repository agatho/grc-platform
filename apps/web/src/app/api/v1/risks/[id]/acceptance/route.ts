// Risk Acceptance API — ISO 27005 Clause 10 formal-acceptance flow.
//
// Triage finding F#3 (overnight 2026-05-18): the schema and authority-
// matrix tables exist (migration 0088) but no API routes wired them up.
// 2026-07-10 rework: the Drizzle schema had drifted from the SQL table
// (accepted_by / justification / risk_score_at_acceptance are NOT NULL in
// 0088 but were missing from the schema, so the old insert would have
// failed at runtime). Route now persists the full record, enforces the
// four-eyes principle (risk owner may not accept their own risk → 422)
// and validates the risk-status transition before flipping to `accepted`.
//
// Endpoints (this file):
//   POST /api/v1/risks/:id/acceptance — formally accept the risk; the
//     server enforces the per-org authority matrix (who may accept which
//     score band). Also flips the risk's status to `accepted` via the
//     risk state-machine.
//   GET  /api/v1/risks/:id/acceptance — list all acceptance records for
//     this risk (active + expired + revoked).
//
// Revoke flow lives at:
//   PATCH /api/v1/risks/:id/acceptance/[acceptanceId]/revoke
//
// Org-wide review list lives at:
//   GET /api/v1/risk-acceptances (+ /[id] detail)
//
// Authority matrix CRUD lives at:
//   /api/v1/risk-acceptance/authority

import {
  db,
  risk,
  riskAcceptance,
  riskAcceptanceAuthority,
  userOrganizationRole,
  notification,
} from "@grc/db";
import {
  createRiskAcceptanceSchema,
  validateAcceptanceFourEyes,
  validateRiskStatusTransition,
  resolveAcceptanceAuthority,
  riskLevelFromScore,
  isRiskStatus,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/risks/:id/acceptance — record a formal acceptance.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "process_owner",
    "ciso",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  const body = createRiskAcceptanceSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [target] = await db
    .select()
    .from(risk)
    .where(
      and(
        eq(risk.id, riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!target) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Four-eyes principle: the risk owner cannot accept their own risk.
  const fourEyes = validateAcceptanceFourEyes({
    riskOwnerId: target.ownerId,
    acceptedBy: ctx.userId,
  });
  if (!fourEyes.ok) {
    return Response.json({ error: fourEyes.reason }, { status: 422 });
  }

  // Acceptance must be a legal move in the risk lifecycle (e.g. a closed
  // risk cannot be accepted — it has to be reopened first).
  if (isRiskStatus(target.status)) {
    const transition = validateRiskStatusTransition({
      from: target.status,
      to: "accepted",
    });
    if (!transition.ok) {
      return Response.json(
        { error: `Cannot accept risk: ${transition.reason}` },
        { status: 422 },
      );
    }
  }

  // Acceptance score: prefer residual (post-treatment) when available,
  // fall back to inherent. If neither is set, refuse — accepting a risk
  // that hasn't been scored is a process-violation in ISO 27005.
  const acceptanceScore =
    target.riskScoreResidual ?? target.riskScoreInherent ?? null;

  if (acceptanceScore === null) {
    return Response.json(
      {
        error:
          "Cannot accept an unscored risk. Set residual likelihood + impact (or inherent) first.",
      },
      { status: 422 },
    );
  }

  // Already-accepted guard: an active acceptance row exists.
  const [existingActive] = await db
    .select({ id: riskAcceptance.id })
    .from(riskAcceptance)
    .where(
      and(
        eq(riskAcceptance.riskId, riskId),
        eq(riskAcceptance.orgId, ctx.orgId),
        eq(riskAcceptance.status, "active"),
      ),
    );

  if (existingActive) {
    return Response.json(
      {
        error: "Risk is already accepted",
        acceptanceId: existingActive.id,
      },
      { status: 409 },
    );
  }

  // Authority enforcement: which role may accept this score band.
  const authorityRows = await db
    .select()
    .from(riskAcceptanceAuthority)
    .where(
      and(
        eq(riskAcceptanceAuthority.orgId, ctx.orgId),
        eq(riskAcceptanceAuthority.isActive, true),
      ),
    );

  const { requiredRole } = resolveAcceptanceAuthority(
    authorityRows.map((row) => ({
      minScore: row.minScore,
      maxScore: row.maxScore,
      requiredRole: row.requiredRole,
      isActive: row.isActive,
    })),
    acceptanceScore,
  );

  // Does this user hold the required role in this org? `admin` is the
  // universal escape hatch — admin can always accept.
  const [hasRole] = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        sql`(${userOrganizationRole.role} = ${requiredRole} OR ${userOrganizationRole.role} = 'admin')`,
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  if (!hasRole) {
    return Response.json(
      {
        error: "Insufficient authority",
        detail: `Accepting a risk with score ${acceptanceScore} requires the role '${requiredRole}' (or admin).`,
        score: acceptanceScore,
        requiredRole,
        riskLevel: riskLevelFromScore(acceptanceScore),
      },
      { status: 403 },
    );
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [accepted] = await tx
        .insert(riskAcceptance)
        .values({
          orgId: ctx.orgId,
          riskId,
          acceptedBy: ctx.userId,
          riskScoreAtAcceptance: acceptanceScore,
          riskLevelAtAcceptance: riskLevelFromScore(acceptanceScore),
          justification: body.data.justification,
          acceptanceConditions: body.data.acceptanceConditions,
          validUntil: body.data.validUntil,
          tags: body.data.tags ?? [],
          status: "active",
        })
        .returning();

      // Flip the risk into status=accepted. We don't run the full state-
      // machine route here because risk acceptance is itself a valid
      // trigger for that transition (validated above); the audit-log
      // entry from this insert carries the action context.
      await tx
        .update(risk)
        .set({
          status: "accepted",
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(risk.id, riskId));

      // Notify the risk owner that their risk was formally accepted.
      if (target.ownerId && target.ownerId !== ctx.userId) {
        await tx.insert(notification).values({
          userId: target.ownerId,
          orgId: ctx.orgId,
          type: "status_change" as const,
          entityType: "risk",
          entityId: riskId,
          title: `Risk formally accepted: ${target.title}`,
          message: `The risk "${target.title}" (score ${acceptanceScore}, ${riskLevelFromScore(acceptanceScore)}) was formally accepted per ISO 27005 Clause 10.${body.data.validUntil ? ` Acceptance is time-bound until ${body.data.validUntil}.` : ""}`,
          channel: "both" as const,
          templateKey: "risk_acceptance_recorded",
          templateData: {
            riskId,
            riskTitle: target.title,
            score: acceptanceScore,
            riskLevel: riskLevelFromScore(acceptanceScore),
            validUntil: body.data.validUntil ?? null,
          },
        });
      }

      return accepted;
    },
    {
      actionDetail: `Accepted risk ${riskId} at score ${acceptanceScore} (${riskLevelFromScore(acceptanceScore)})`,
      reason: body.data.justification,
    },
  );

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/risks/:id/acceptance — list acceptance history.
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

  const { id: riskId } = await params;

  const rows = await db
    .select()
    .from(riskAcceptance)
    .where(
      and(
        eq(riskAcceptance.riskId, riskId),
        eq(riskAcceptance.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(riskAcceptance.acceptedAt));

  return Response.json({ data: rows });
}
