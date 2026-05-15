// GET /api/v1/isms/threats/[id]/transitions
//
// #WAVE11-THREAT-TRANSITIONS: deferred from Wave 11 with the
// "stateless by design" tag. Threat is a pure catalog-reference
// entity (catalog_entry_id + likelihood_rating + category) — there's
// no `status` column and no lifecycle. Threats either exist in the
// catalog or don't (org-side soft-delete via deletedAt — actually the
// table has none, removal is via the catalog).
//
// See assets/[id]/transitions for the rationale on serving an
// explicit stateless payload rather than a 404 — uniform API shape.

import { db, threat } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  requireUuidParam(id);

  const [row] = await db
    .select({
      id: threat.id,
      title: threat.title,
      threatCategory: threat.threatCategory,
      likelihoodRating: threat.likelihoodRating,
    })
    .from(threat)
    .where(and(eq(threat.id, id), eq(threat.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Threat not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: null,
      allowedNext: [],
      stateless: true,
      category: row.threatCategory,
      likelihoodRating: row.likelihoodRating,
      updateEndpoint: `/api/v1/isms/threats/${id}`,
      updateMethod: "PUT",
      note: "Threat is stateless by design — it's a catalog-referenced asset rather than a lifecycle entity. Adjust likelihood_rating or category via the PUT endpoint; risk-scenario links carry the per-context state instead.",
    },
  });
});
