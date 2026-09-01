import {
  db,
  ddSession,
  ddResponse,
  ddEvidence,
  questionnaireSection,
  questionnaireQuestion,
  runWithRequestContext,
} from "@grc/db";
import { portalSubmitSchema } from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/v1/portal/dd/:token/submit — Finalize submission
export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const result = await validateDdToken(token, req);
  if (result instanceof Response) return result;
  // #WP3-S02-05 — everything below reads/writes FORCE-RLS tables
  // (`dd_session`, `dd_response`, `dd_evidence`, `vendor`, questionnaire
  // tables). This handler is anonymous by design, so no request context
  // existed and every query was RLS-filtered to 0 rows under `grc_app` —
  // the portal answered with an empty questionnaire instead of failing.
  // The org is now known from the resolved token, so pin it for the rest of
  // the handler; the `db` proxy routes to that connection automatically.
  return runWithRequestContext(
    { orgId: result.orgId, userId: "" },
    async () => {
      const { session } = result;

      const body = portalSubmitSchema.safeParse(await req.json());
      if (!body.success) {
        return Response.json(
          { error: "Validation failed", details: body.error.flatten() },
          { status: 422 },
        );
      }

      // Verify all required questions are answered
      const unanswered = (await db.execute(sql`
      SELECT q.id, q.question_de, q.question_en
      FROM questionnaire_question q
      INNER JOIN questionnaire_section s ON q.section_id = s.id
      LEFT JOIN dd_response r ON r.question_id = q.id AND r.session_id = ${session.id}
      WHERE s.template_id = ${session.templateId}
        AND q.is_required = true
        AND r.id IS NULL
    `)) as unknown as Array<Record<string, unknown>>;

      if (unanswered.length > 0) {
        return Response.json(
          {
            error: "Required questions unanswered",
            unanswered,
          },
          { status: 400 },
        );
      }

      // Verify required evidence is uploaded
      const missingEvidence = (await db.execute(sql`
      SELECT q.id, q.question_de, q.question_en
      FROM questionnaire_question q
      INNER JOIN questionnaire_section s ON q.section_id = s.id
      LEFT JOIN dd_evidence e ON e.question_id = q.id AND e.session_id = ${session.id}
      WHERE s.template_id = ${session.templateId}
        AND q.is_evidence_required = true
        AND e.id IS NULL
    `)) as unknown as Array<Record<string, unknown>>;

      if (missingEvidence.length > 0) {
        return Response.json(
          {
            error: "Required evidence missing",
            missing: missingEvidence,
          },
          { status: 400 },
        );
      }

      // Compute total score
      const scoreResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${ddResponse.score}), 0)::int`,
        })
        .from(ddResponse)
        .where(eq(ddResponse.sessionId, session.id));

      const maxResultRows = (await db.execute(sql`
      SELECT COALESCE(SUM(q.max_score), 0)::int as total
      FROM questionnaire_question q
      INNER JOIN questionnaire_section s ON q.section_id = s.id
      WHERE s.template_id = ${session.templateId}
    `)) as unknown as Array<Record<string, unknown>>;

      const totalScore = scoreResult[0]?.total ?? 0;
      const maxPossibleScore = (maxResultRows[0]?.total as number) ?? 0;

      await db
        .update(ddSession)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          tokenUsedAt: new Date(),
          progressPercent: 100,
          totalScore,
          maxPossibleScore,
          updatedAt: new Date(),
        })
        .where(eq(ddSession.id, session.id));

      return Response.json({
        status: "submitted",
        totalScore,
        maxPossibleScore,
        percent:
          maxPossibleScore > 0
            ? Math.round((totalScore / maxPossibleScore) * 100)
            : 0,
      });
    },
  );
}
