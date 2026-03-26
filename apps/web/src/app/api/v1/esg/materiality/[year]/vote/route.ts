import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esgMaterialityVote,
} from "@grc/db";
import { submitVoteSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/esg/materiality/[year]/vote — Submit stakeholder vote
export async function POST(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const body = submitVoteSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify assessment exists and is in_progress
  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json(
      { error: "Assessment not found" },
      { status: 404 },
    );
  }

  if (assessment.status !== "in_progress") {
    return Response.json(
      { error: "Assessment must be in_progress to accept votes" },
      { status: 400 },
    );
  }

  // Verify topic belongs to this assessment
  const [topic] = await db
    .select()
    .from(esgMaterialityTopic)
    .where(
      and(
        eq(esgMaterialityTopic.id, body.data.topicId),
        eq(esgMaterialityTopic.assessmentId, assessment.id),
      ),
    );

  if (!topic) {
    return Response.json(
      { error: "Topic not found in this assessment" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [vote] = await tx
      .insert(esgMaterialityVote)
      .values({
        topicId: body.data.topicId,
        voterId: ctx.userId,
        voterName: body.data.voterName ?? ctx.session.user.name,
        voterType: body.data.voterType,
        impactScore: String(body.data.impactScore),
        financialScore: String(body.data.financialScore),
        comment: body.data.comment,
      })
      .returning();
    return vote;
  });

  return Response.json({ data: created }, { status: 201 });
}
