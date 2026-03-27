import { db, rcsaCampaign, rcsaAssignment, risk, control, notification } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/rcsa/campaigns/:id/launch — Launch campaign, generate assignments
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "draft") {
    return Response.json(
      { error: "Only draft campaigns can be launched" },
      { status: 409 },
    );
  }

  const scope = campaign.targetScope as {
    departments?: string[];
    orgIds?: string[];
    roles?: string[];
  };

  const deadline = new Date(campaign.periodEnd + "T23:59:59Z");

  const result = await withAuditContext(ctx, async (tx) => {
    // 1. Find risks matching scope with owners
    const riskConditions = [
      eq(risk.orgId, ctx.orgId),
      isNull(risk.deletedAt),
    ];

    const matchingRisks = await tx
      .select({
        id: risk.id,
        ownerId: risk.ownerId,
        department: risk.department,
      })
      .from(risk)
      .where(and(...riskConditions));

    // Filter by scope
    const filteredRisks = matchingRisks.filter((r: { id: string; ownerId: string | null; department: string | null }) => {
      if (!r.ownerId) return false;
      if (scope.departments?.length && r.department) {
        return scope.departments.includes(r.department);
      }
      // If no department filter, include all risks with owners
      return true;
    });

    // 2. Find controls matching scope with owners
    const controlConditions = [
      eq(control.orgId, ctx.orgId),
      isNull(control.deletedAt),
    ];

    const matchingControls = await tx
      .select({
        id: control.id,
        ownerId: control.ownerId,
        department: control.department,
      })
      .from(control)
      .where(and(...controlConditions));

    const filteredControls = matchingControls.filter((c: { id: string; ownerId: string | null; department: string | null }) => {
      if (!c.ownerId) return false;
      if (scope.departments?.length && c.department) {
        return scope.departments.includes(c.department);
      }
      return true;
    });

    // 3. Create assignments for risks
    const riskAssignments = filteredRisks.map((r: { id: string; ownerId: string | null; department: string | null }) => ({
      campaignId: id,
      orgId: ctx.orgId,
      userId: r.ownerId!,
      entityType: "risk" as const,
      entityId: r.id,
      deadline,
      status: "pending" as const,
    }));

    // 4. Create assignments for controls
    const controlAssignments = filteredControls.map((c: { id: string; ownerId: string | null; department: string | null }) => ({
      campaignId: id,
      orgId: ctx.orgId,
      userId: c.ownerId!,
      entityType: "control" as const,
      entityId: c.id,
      deadline,
      status: "pending" as const,
    }));

    const allAssignments = [...riskAssignments, ...controlAssignments];

    if (allAssignments.length > 0) {
      await tx.insert(rcsaAssignment).values(allAssignments);
    }

    // 5. Update campaign status to active
    const [updated] = await tx
      .update(rcsaCampaign)
      .set({
        status: "active",
        launchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rcsaCampaign.id, id))
      .returning();

    // 6. Send notifications to unique participants
    const uniqueUserIds = [
      ...new Set(allAssignments.map((a) => a.userId)),
    ];

    for (const userId of uniqueUserIds) {
      const userAssignmentCount = allAssignments.filter((a) => a.userId === userId).length;
      await tx.insert(notification).values({
        orgId: ctx.orgId,
        userId,
        type: "action_required",
        entityType: "rcsa_campaign",
        entityId: id,
        title: `RCSA Assessment: ${campaign.name}`,
        message: `You have ${userAssignmentCount} item(s) to assess in "${campaign.name}". Deadline: ${campaign.periodEnd}.`,
        channel: "both",
        templateKey: "rcsa_invitation",
        templateData: {
          campaignName: campaign.name,
          assignmentCount: userAssignmentCount,
          deadline: campaign.periodEnd,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      campaign: updated,
      assignmentsCreated: allAssignments.length,
      riskAssignments: riskAssignments.length,
      controlAssignments: controlAssignments.length,
      participantCount: uniqueUserIds.length,
    };
  });

  return Response.json({ data: result }, { status: 200 });
}
