import {
  db,
  ddSession,
  ddResponse,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { portalSaveResponsesSchema } from "@grc/shared";
import { eq, and, count, sql } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// PUT /api/v1/portal/dd/:token/responses — Auto-save batch of responses
export async function PUT(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const result = await validateDdToken(token, req);
  if (result instanceof Response) return result;

  const session = result.session;

  const body = portalSaveResponsesSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  for (const resp of body.data.responses) {
    // Verify question exists
    const question = await db.query.questionnaireQuestion.findFirst({
      where: eq(questionnaireQuestion.id, resp.questionId),
    });
    if (!question) continue;

    // Auto-compute score for choice questions
    let score: number | null = null;
    if (
      ["single_choice", "multi_choice"].includes(question.questionType) &&
      resp.answerChoice
    ) {
      const options = question.options as Array<{
        value: string;
        score: number;
      }>;
      score = resp.answerChoice.reduce((sum, val) => {
        const opt = options?.find((o) => o.value === val);
        return sum + (opt?.score ?? 0);
      }, 0);
    }
    if (
      question.questionType === "yes_no" &&
      resp.answerBoolean !== undefined
    ) {
      const options = question.options as Array<{
        value: string;
        score: number;
      }>;
      const val = resp.answerBoolean ? "yes" : "no";
      score = options?.find((o) => o.value === val)?.score ?? 0;
    }

    await db
      .insert(ddResponse)
      .values({
        sessionId: session.id,
        questionId: resp.questionId,
        answerText: resp.answerText ?? null,
        answerChoice: resp.answerChoice ?? null,
        answerNumber: resp.answerNumber?.toString() ?? null,
        answerDate: resp.answerDate ?? null,
        answerBoolean: resp.answerBoolean ?? null,
        score,
      })
      .onConflictDoUpdate({
        target: [ddResponse.sessionId, ddResponse.questionId],
        set: {
          answerText: resp.answerText ?? null,
          answerChoice: resp.answerChoice ?? null,
          answerNumber: resp.answerNumber?.toString() ?? null,
          answerDate: resp.answerDate ?? null,
          answerBoolean: resp.answerBoolean ?? null,
          score,
          updatedAt: new Date(),
        },
      });
  }

  // Recompute progress based on required questions answered
  const totalRequired = await db
    .select({ value: count() })
    .from(questionnaireQuestion)
    .innerJoin(
      questionnaireSection,
      eq(questionnaireQuestion.sectionId, questionnaireSection.id),
    )
    .where(
      and(
        eq(questionnaireSection.templateId, session.templateId),
        eq(questionnaireQuestion.isRequired, true),
      ),
    );

  const answered = await db
    .select({ value: count() })
    .from(ddResponse)
    .where(eq(ddResponse.sessionId, session.id));

  const requiredCount = totalRequired[0]?.value ?? 1;
  const answeredCount = answered[0]?.value ?? 0;
  const progress = Math.round(
    (answeredCount / Math.max(requiredCount, 1)) * 100,
  );
  const progressPercent = Math.min(progress, 100);

  await db
    .update(ddSession)
    .set({ progressPercent, updatedAt: new Date() })
    .where(eq(ddSession.id, session.id));

  return Response.json({
    progressPercent,
    savedCount: body.data.responses.length,
  });
}
