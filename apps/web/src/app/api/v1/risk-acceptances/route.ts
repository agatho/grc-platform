// GET /api/v1/risk-acceptances — org-wide risk-acceptance review list.
//
// ISO 27005 Clause 10 requires periodic review of all formal acceptance
// decisions. The per-risk history lives at /api/v1/risks/:id/acceptance;
// this endpoint is the cross-risk cockpit view: filterable by status and
// upcoming expiry (`expiringBefore`), paginated, joined with risk title
// and acceptor identity.
//
// Read access mirrors GET /risks/:id/acceptance (auditors + viewers
// included — acceptance decisions are exactly what a 3rd-line reviewer
// needs to see). Creation stays on the per-risk endpoint because an
// acceptance is meaningless without its risk context.

import { db, risk, riskAcceptance, user } from "@grc/db";
import { riskAcceptanceListQuerySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq, desc, asc, count, lte, isNotNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  withAuth,
  paginate,
  paginatedResponse,
  searchParamsToObject,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const ALLOWED_PARAMS = [
  "status",
  "riskId",
  "expiringBefore",
  "sort",
  "sortDir",
] as const;

export const GET = withErrorHandler(async function GET(req: Request) {
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

  const { page, limit, offset, searchParams } = paginate(req, {
    allowedParams: ALLOWED_PARAMS,
  });

  const query = riskAcceptanceListQuerySchema.safeParse(
    searchParamsToObject(searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const conditions: SQL[] = [eq(riskAcceptance.orgId, ctx.orgId)];
  if (query.data.status) {
    conditions.push(eq(riskAcceptance.status, query.data.status));
  }
  if (query.data.riskId) {
    conditions.push(eq(riskAcceptance.riskId, query.data.riskId));
  }
  if (query.data.expiringBefore) {
    conditions.push(isNotNull(riskAcceptance.validUntil));
    conditions.push(lte(riskAcceptance.validUntil, query.data.expiringBefore));
  }
  const where = and(...conditions);

  const sortColumn =
    query.data.sort === "validUntil"
      ? riskAcceptance.validUntil
      : query.data.sort === "status"
        ? riskAcceptance.status
        : riskAcceptance.acceptedAt;
  const direction = query.data.sortDir === "asc" ? asc : desc;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: riskAcceptance.id,
        riskId: riskAcceptance.riskId,
        riskTitle: risk.title,
        status: riskAcceptance.status,
        acceptedAt: riskAcceptance.acceptedAt,
        acceptedBy: riskAcceptance.acceptedBy,
        acceptedByName: user.name,
        acceptedByEmail: user.email,
        riskScoreAtAcceptance: riskAcceptance.riskScoreAtAcceptance,
        riskLevelAtAcceptance: riskAcceptance.riskLevelAtAcceptance,
        validUntil: riskAcceptance.validUntil,
        acceptanceConditions: riskAcceptance.acceptanceConditions,
        justification: riskAcceptance.justification,
        revokedAt: riskAcceptance.revokedAt,
        tags: riskAcceptance.tags,
      })
      .from(riskAcceptance)
      .leftJoin(risk, eq(risk.id, riskAcceptance.riskId))
      .leftJoin(user, eq(user.id, riskAcceptance.acceptedBy))
      .where(where)
      // Deterministic pagination: id tiebreaker (Wave-cycle convention).
      .orderBy(direction(sortColumn), asc(riskAcceptance.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(riskAcceptance).where(where),
  ]);

  return paginatedResponse(rows, Number(total ?? 0), page, limit);
});

// Explicit 405 for POST — acceptances are created on the risk itself:
// POST /api/v1/risks/:id/acceptance (the risk context is mandatory).
export async function POST() {
  return Response.json(
    {
      error: "Method not allowed",
      detail:
        "Create acceptances via POST /api/v1/risks/{riskId}/acceptance — an acceptance decision always belongs to a specific risk.",
    },
    { status: 405, headers: { Allow: "GET" } },
  );
}
