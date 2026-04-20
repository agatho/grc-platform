import { db, rcsaAssignment, rcsaResponse, rcsaCampaign } from "@grc/db";
import {
  submitRiskResponseSchema,
  submitControlResponseSchema,
} from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/v1/rcsa/assignments/:id/respond — Submit risk or control response
export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Get assignment
  const [assignment] = await db
    .select()
    .from(rcsaAssignment)
    .where(and(eq(rcsaAssignment.id, id), eq(rcsaAssignment.orgId, ctx.orgId)));

  if (!assignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Must be the assigned user
  if (assignment.userId !== ctx.userId) {
    return Response.json(
      { error: "You can only respond to your own assignments" },
      { status: 403 },
    );
  }

  // Check if assignment is already submitted
  if (assignment.status === "submitted") {
    return Response.json(
      { error: "Assignment already submitted" },
      { status: 409 },
    );
  }

  // Check deadline: get campaign periodEnd
  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(eq(rcsaCampaign.id, assignment.campaignId));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "active") {
    return Response.json({ error: "Campaign is not active" }, { status: 409 });
  }

  // Enforce deadline
  const now = new Date();
  const periodEndDate = new Date(campaign.periodEnd + "T23:59:59Z");
  if (now > periodEndDate) {
    return Response.json(
      {
        error:
          "Campaign deadline has passed. Responses are no longer accepted.",
      },
      { status: 409 },
    );
  }

  const rawBody = await req.json();

  // Validate based on entity type
  if (assignment.entityType === "risk") {
    const body = submitRiskResponseSchema.safeParse(rawBody);
    if (!body.success) {
      return Response.json(
        { error: "Validation failed", details: body.error.flatten() },
        { status: 422 },
      );
    }

    const result = await withAuditContext(ctx, async (tx) => {
      // Insert response
      const [response] = await tx
        .insert(rcsaResponse)
        .values({
          assignmentId: id,
          orgId: ctx.orgId,
          riskStillRelevant: body.data.riskStillRelevant,
          likelihoodAssessment: body.data.likelihoodAssessment,
          impactAssessment: body.data.impactAssessment,
          riskTrend: body.data.riskTrend,
          comment: body.data.comment,
          confidence: body.data.confidence,
          evidenceIds: body.data.evidenceIds ?? [],
          respondedAt: now,
        })
        .returning();

      // Update assignment status
      const [updated] = await tx
        .update(rcsaAssignment)
        .set({
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(rcsaAssignment.id, id))
        .returning();

      return { assignment: updated, response };
    });

    return Response.json({ data: result });
  }

  if (assignment.entityType === "control") {
    const body = submitControlResponseSchema.safeParse(rawBody);
    if (!body.success) {
      return Response.json(
        { error: "Validation failed", details: body.error.flatten() },
        { status: 422 },
      );
    }

    const result = await withAuditContext(ctx, async (tx) => {
      const [response] = await tx
        .insert(rcsaResponse)
        .values({
          assignmentId: id,
          orgId: ctx.orgId,
          controlEffectiveness: body.data.controlEffectiveness,
          controlOperating: body.data.controlOperating,
          controlWeaknesses: body.data.controlWeaknesses,
          comment: body.data.comment,
          confidence: body.data.confidence,
          evidenceIds: body.data.evidenceIds ?? [],
          respondedAt: now,
        })
        .returning();

      const [updated] = await tx
        .update(rcsaAssignment)
        .set({
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(rcsaAssignment.id, id))
        .returning();

      return { assignment: updated, response };
    });

    return Response.json({ data: result });
  }

  return Response.json({ error: "Unknown entity type" }, { status: 400 });
}
