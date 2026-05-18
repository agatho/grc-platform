// Risk-Acceptance Authority Matrix CRUD.
//
// Per ISO 27005 Clause 10 the org must define which role may accept
// risks at each severity band. Stored in `risk_acceptance_authority`.
// The POST endpoint on /api/v1/risks/:id/acceptance enforces these rows.
//
// Read access is broad (everyone needs to know who they need to escalate
// to). Write access is admin-only — modifying the matrix is itself a
// load-bearing governance decision and should be visible in audit_log.

import { db, riskAcceptanceAuthority } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const ROLE_VALUES = [
  "admin",
  "risk_manager",
  "control_owner",
  "process_owner",
  "ciso",
  "dpo",
] as const;

const upsertAuthoritySchema = z.object({
  entries: z
    .array(
      z.object({
        maxScore: z.number().int().min(1).max(25),
        requiredRole: z.enum(ROLE_VALUES),
        requiredRoleLabel: z.string().max(200).optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(10),
});

// GET /api/v1/risk-acceptance/authority — list authority matrix.
export async function GET(req: Request) {
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

  const rows = await db
    .select()
    .from(riskAcceptanceAuthority)
    .where(eq(riskAcceptanceAuthority.orgId, ctx.orgId))
    .orderBy(asc(riskAcceptanceAuthority.maxScore));

  return Response.json({ data: rows });
}

// PUT /api/v1/risk-acceptance/authority — replace the matrix wholesale.
//
// "Replace" rather than "patch" because the matrix is small (5-10 rows)
// and overlapping bands are easy to introduce by accident. The route
// deactivates existing rows then inserts the new ones in one tx so the
// authority enforcement on /acceptance never sees a partial state.
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = upsertAuthoritySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Reject duplicate maxScore rows up front — the matrix uses ASC ordering
  // and "first row whose max_score >= riskScore" lookup; duplicates make
  // that non-deterministic.
  const seen = new Set<number>();
  for (const e of body.data.entries) {
    if (seen.has(e.maxScore)) {
      return Response.json(
        { error: `Duplicate maxScore in request: ${e.maxScore}` },
        { status: 422 },
      );
    }
    seen.add(e.maxScore);
  }

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      // Soft-deactivate the current matrix. We don't DELETE so that
      // audit_log keeps the reference intact.
      await tx
        .update(riskAcceptanceAuthority)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(riskAcceptanceAuthority.orgId, ctx.orgId),
            eq(riskAcceptanceAuthority.isActive, true),
          ),
        );

      const inserted = await tx
        .insert(riskAcceptanceAuthority)
        .values(
          body.data.entries.map((e) => ({
            orgId: ctx.orgId,
            maxScore: e.maxScore,
            requiredRole: e.requiredRole,
            requiredRoleLabel: e.requiredRoleLabel,
            isActive: e.isActive,
          })),
        )
        .returning();

      return inserted;
    },
    {
      actionDetail: `Updated risk-acceptance authority matrix (${body.data.entries.length} rows)`,
    },
  );

  return Response.json({ data: updated });
}
