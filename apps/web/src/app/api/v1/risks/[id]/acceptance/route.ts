// Risk Acceptance API — ISO 27005 Clause 10 formal-acceptance flow.
//
// Triage finding F#3 (overnight 2026-05-18): the schema and authority-
// matrix tables exist (migrations 0079 + 0087) but no API routes wired
// them up. CLAUDE.md claimed the feature was ✅ Done.
//
// Endpoints (this file):
//   POST /api/v1/risks/:id/acceptance — formally accept the risk; the
//     server enforces the per-org authority matrix (who may accept which
//     score band). Also flips the risk's status to `accepted` via the
//     risk state-machine.
//   GET  /api/v1/risks/:id/acceptance — list all acceptance records for
//     this risk (active + revoked).
//
// Revoke flow lives at:
//   PATCH /api/v1/risks/:id/acceptance/[acceptanceId]/revoke
//
// Authority matrix CRUD lives at:
//   /api/v1/risk-acceptance/authority

import {
  db,
  risk,
  riskAcceptance,
  riskAcceptanceAuthority,
  userOrganizationRole,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, desc, asc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const acceptRiskSchema = z.object({
  // Optional rationale persisted into the audit annotation. Not stored
  // on the risk_acceptance row itself because the table doesn't have a
  // dedicated column — the rationale lands in audit_log.metadata.reason.
  reason: z.string().min(10).max(2000).optional(),
});

function riskLevelFromScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "unknown";
  if (score <= 3) return "low";
  if (score <= 9) return "medium";
  if (score <= 15) return "high";
  return "critical";
}

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

  const body = acceptRiskSchema.safeParse(await req.json().catch(() => ({})));
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

  // Already-accepted guard: an active (non-revoked) acceptance row exists.
  const [existingActive] = await db
    .select({ id: riskAcceptance.id })
    .from(riskAcceptance)
    .where(
      and(
        eq(riskAcceptance.riskId, riskId),
        eq(riskAcceptance.orgId, ctx.orgId),
        isNull(riskAcceptance.revokedAt),
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

  // Authority enforcement. Pick the lowest `max_score >= acceptanceScore`
  // row from the active matrix. If no row covers this score (e.g. a
  // catastrophic risk above the highest band), fall back to admin.
  const authorityRows = await db
    .select()
    .from(riskAcceptanceAuthority)
    .where(
      and(
        eq(riskAcceptanceAuthority.orgId, ctx.orgId),
        eq(riskAcceptanceAuthority.isActive, true),
      ),
    )
    .orderBy(asc(riskAcceptanceAuthority.maxScore));

  const covering = authorityRows.find((row) => row.maxScore >= acceptanceScore);
  const requiredRole = covering?.requiredRole ?? "admin";

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
          riskLevelAtAcceptance: riskLevelFromScore(acceptanceScore),
        })
        .returning();

      // Flip the risk into status=accepted. We don't run the full state-
      // machine here because risk acceptance is itself a valid trigger
      // for that transition; the audit-log entry from this insert carries
      // the action context.
      await tx
        .update(risk)
        .set({
          status: "accepted",
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(risk.id, riskId));

      return accepted;
    },
    {
      actionDetail: `Accepted risk ${riskId} at score ${acceptanceScore} (${riskLevelFromScore(acceptanceScore)})`,
      reason: body.data.reason,
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
