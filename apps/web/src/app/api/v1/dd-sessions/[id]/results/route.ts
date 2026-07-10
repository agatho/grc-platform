import {
  db,
  ddSession,
  ddResponse,
  ddEvidence,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/dd-sessions/:id/results — Get responses, scores, gap analysis
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const session = await db.query.ddSession.findFirst({
    where: and(eq(ddSession.id, id), eq(ddSession.orgId, ctx.orgId)),
  });

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch sections with questions
  const sections = await db
    .select()
    .from(questionnaireSection)
    .where(eq(questionnaireSection.templateId, session.templateId))
    .orderBy(asc(questionnaireSection.sortOrder));

  // Fetch all questions across all sections.
  //
  // #PERF-N-PLUS-1: was one SELECT per section (10–20 round-trips per
  // template) plus a redundant first-section pre-fetch. Replaced with a
  // single inArray query; the per-section grouping below already
  // happens in memory via `filter`. Within-section ordering is
  // preserved (sortOrder asc, same as the old per-section orderBy).
  const sectionIds = sections.map((s) => s.id);
  const allQuestions: Array<typeof questionnaireQuestion.$inferSelect> =
    sectionIds.length > 0
      ? await db
          .select()
          .from(questionnaireQuestion)
          .where(inArray(questionnaireQuestion.sectionId, sectionIds))
          .orderBy(asc(questionnaireQuestion.sortOrder))
      : [];

  // Fetch all responses
  const responses = await db
    .select()
    .from(ddResponse)
    .where(eq(ddResponse.sessionId, id));

  // Fetch all evidence
  const evidence = await db
    .select()
    .from(ddEvidence)
    .where(eq(ddEvidence.sessionId, id));

  // Build response map for quick lookup
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  // Compute per-section scores
  const sectionResults = sections.map((section) => {
    const sectionQuestions = allQuestions.filter(
      (q) => q.sectionId === section.id,
    );
    let sectionScore = 0;
    let sectionMaxScore = 0;
    const gaps: Array<{
      questionId: string;
      questionDe: string;
      questionEn: string;
      maxScore: number;
      actualScore: number;
      gap: number;
    }> = [];

    for (const q of sectionQuestions) {
      const maxScore = q.maxScore ?? 0;
      sectionMaxScore += maxScore;
      const resp = responseMap.get(q.id);
      const actualScore = resp?.score ?? 0;
      sectionScore += actualScore;

      if (maxScore > 0 && actualScore < maxScore) {
        gaps.push({
          questionId: q.id,
          questionDe: q.questionDe,
          questionEn: q.questionEn,
          maxScore,
          actualScore,
          gap: maxScore - actualScore,
        });
      }
    }

    return {
      sectionId: section.id,
      titleDe: section.titleDe,
      titleEn: section.titleEn,
      score: sectionScore,
      maxScore: sectionMaxScore,
      percent:
        sectionMaxScore > 0
          ? Math.round((sectionScore / sectionMaxScore) * 100)
          : 0,
      gaps: gaps.sort((a, b) => b.gap - a.gap),
    };
  });

  const totalScore = sectionResults.reduce((s, r) => s + r.score, 0);
  const totalMaxScore = sectionResults.reduce((s, r) => s + r.maxScore, 0);

  return Response.json({
    data: {
      session: {
        id: session.id,
        status: session.status,
        submittedAt: session.submittedAt,
        progressPercent: session.progressPercent,
      },
      scoring: {
        totalScore,
        totalMaxScore,
        percent:
          totalMaxScore > 0
            ? Math.round((totalScore / totalMaxScore) * 100)
            : 0,
      },
      sections: sectionResults,
      responses,
      evidence,
    },
  });
}
