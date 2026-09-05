import { db, rcsaAssignment, rcsaCampaign, risk, control, user } from "@grc/db";
import { eq, and, count } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id/assignments — All assignments for campaign
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: RouteParams,
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  // Verify campaign exists in org
  const [campaign] = await db
    .select({ id: rcsaCampaign.id })
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const conditions: SQL[] = [
    eq(rcsaAssignment.campaignId, id),
    eq(rcsaAssignment.orgId, ctx.orgId),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const { inArray } = await import("drizzle-orm");
    conditions.push(inArray(rcsaAssignment.status, statusParam.split(",")));
  }

  const entityTypeParam = searchParams.get("entityType");
  if (entityTypeParam) {
    conditions.push(eq(rcsaAssignment.entityType, entityTypeParam));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(rcsaAssignment)
      .where(where)
      .orderBy(rcsaAssignment.deadline)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(rcsaAssignment).where(where),
  ]);

  // Enrich with entity + user details
  const enriched = await Promise.all(
    items.map(async (assignment) => {
      let entityTitle: string | undefined;
      let entityDepartment: string | undefined;

      if (assignment.entityType === "risk") {
        const [r] = await db
          .select({ title: risk.title, department: risk.department })
          .from(risk)
          .where(eq(risk.id, assignment.entityId));
        entityTitle = r?.title;
        entityDepartment = r?.department ?? undefined;
      } else {
        const [c] = await db
          .select({ title: control.title, department: control.department })
          .from(control)
          .where(eq(control.id, assignment.entityId));
        entityTitle = c?.title;
        entityDepartment = c?.department ?? undefined;
      }

      const [u] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, assignment.userId));

      return {
        ...assignment,
        entityTitle,
        entityDepartment,
        userName: u?.name,
        userEmail: u?.email,
      };
    }),
  );

  return paginatedResponse(enriched, total, page, limit);
});
