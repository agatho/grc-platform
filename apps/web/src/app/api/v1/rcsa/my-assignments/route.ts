import {
  db,
  rcsaAssignment,
  rcsaCampaign,
  rcsaResponse,
  risk,
  control,
} from "@grc/db";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/rcsa/my-assignments — Current user's assignments
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(rcsaAssignment.userId, ctx.userId),
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

  const campaignIdParam = searchParams.get("campaignId");
  if (campaignIdParam) {
    conditions.push(eq(rcsaAssignment.campaignId, campaignIdParam));
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

  // Enrich with entity details + campaign name + existing response
  const enriched = await Promise.all(
    items.map(async (assignment) => {
      let entityTitle: string | undefined;
      let entityDepartment: string | undefined;
      let entityCategory: string | undefined;

      if (assignment.entityType === "risk") {
        const [r] = await db
          .select({
            title: risk.title,
            department: risk.department,
            category: risk.riskCategory,
          })
          .from(risk)
          .where(eq(risk.id, assignment.entityId));
        entityTitle = r?.title;
        entityDepartment = r?.department ?? undefined;
        entityCategory = r?.category;
      } else {
        const [c] = await db
          .select({
            title: control.title,
            department: control.department,
            controlType: control.controlType,
          })
          .from(control)
          .where(eq(control.id, assignment.entityId));
        entityTitle = c?.title;
        entityDepartment = c?.department ?? undefined;
        entityCategory = c?.controlType;
      }

      const [campaign] = await db
        .select({ name: rcsaCampaign.name })
        .from(rcsaCampaign)
        .where(eq(rcsaCampaign.id, assignment.campaignId));

      // Get existing response if any
      const [existingResponse] = await db
        .select()
        .from(rcsaResponse)
        .where(eq(rcsaResponse.assignmentId, assignment.id))
        .orderBy(desc(rcsaResponse.respondedAt))
        .limit(1);

      return {
        ...assignment,
        entityTitle,
        entityDepartment,
        entityCategory,
        campaignName: campaign?.name,
        response: existingResponse ?? null,
      };
    }),
  );

  return paginatedResponse(enriched, total, page, limit);
}
