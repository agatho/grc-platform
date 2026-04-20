import { db, rcsaCampaign, rcsaAssignment } from "@grc/db";
import { createRcsaCampaignSchema } from "@grc/shared";
import { eq, and, count, desc, ilike, or, sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/rcsa/campaigns — Create campaign (admin/risk_manager)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createRcsaCampaignSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate periodEnd > periodStart
  if (body.data.periodEnd <= body.data.periodStart) {
    return Response.json(
      { error: "periodEnd must be after periodStart" },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(rcsaCampaign)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        frequency: body.data.frequency,
        targetScope: body.data.targetScope,
        cesWeight: body.data.cesWeight,
        reminderDaysBefore: body.data.reminderDaysBefore,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/rcsa/campaigns — List campaigns (paginated)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(rcsaCampaign.orgId, ctx.orgId)];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(rcsaCampaign.name, pattern),
        ilike(rcsaCampaign.description, pattern),
      )!,
    );
  }

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const { inArray } = await import("drizzle-orm");
    const statuses = statusParam.split(",");
    conditions.push(inArray(rcsaCampaign.status, statuses));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(rcsaCampaign)
      .where(where)
      .orderBy(desc(rcsaCampaign.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(rcsaCampaign).where(where),
  ]);

  // Enrich with assignment stats
  const enriched = await Promise.all(
    items.map(async (campaign) => {
      const [stats] = await db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${rcsaAssignment.status} = 'submitted')`,
          participants: sql<number>`count(distinct ${rcsaAssignment.userId})`,
        })
        .from(rcsaAssignment)
        .where(eq(rcsaAssignment.campaignId, campaign.id));

      const totalCount = Number(stats?.total ?? 0);
      const completedCount = Number(stats?.completed ?? 0);

      return {
        ...campaign,
        totalAssignments: totalCount,
        completedCount,
        completionRate:
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        participantCount: Number(stats?.participants ?? 0),
      };
    }),
  );

  return paginatedResponse(enriched, total, page, limit);
}
