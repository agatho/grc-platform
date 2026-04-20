import { db, rcsaCampaign, rcsaAssignment } from "@grc/db";
import { updateRcsaCampaignSchema } from "@grc/shared";
import { eq, and, count, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id — Campaign detail + stats
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get assignment stats
  const [stats] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${rcsaAssignment.status} = 'submitted')`,
      overdue: sql<number>`count(*) filter (where ${rcsaAssignment.status} = 'overdue')`,
      pending: sql<number>`count(*) filter (where ${rcsaAssignment.status} IN ('pending', 'in_progress'))`,
      participants: sql<number>`count(distinct ${rcsaAssignment.userId})`,
    })
    .from(rcsaAssignment)
    .where(eq(rcsaAssignment.campaignId, id));

  const totalCount = Number(stats?.total ?? 0);
  const completedCount = Number(stats?.completed ?? 0);

  return Response.json({
    data: {
      ...campaign,
      totalAssignments: totalCount,
      completedCount,
      overdueCount: Number(stats?.overdue ?? 0),
      pendingCount: Number(stats?.pending ?? 0),
      completionRate:
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      participantCount: Number(stats?.participants ?? 0),
    },
  });
}

// PUT /api/v1/rcsa/campaigns/:id — Update campaign (draft only)
export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateRcsaCampaignSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return Response.json(
      { error: "Only draft campaigns can be updated" },
      { status: 409 },
    );
  }

  if (
    body.data.periodEnd &&
    body.data.periodStart &&
    body.data.periodEnd <= body.data.periodStart
  ) {
    return Response.json(
      { error: "periodEnd must be after periodStart" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(rcsaCampaign)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/rcsa/campaigns/:id — Delete (draft only)
export async function DELETE(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return Response.json(
      { error: "Only draft campaigns can be deleted" },
      { status: 409 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(rcsaCampaign)
      .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));
  });

  return Response.json({ data: { deleted: true } });
}
