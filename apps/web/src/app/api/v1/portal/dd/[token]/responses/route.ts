import {
  db,
  ddSession,
  ddResponse,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { portalSaveResponsesSchema } from "@grc/shared";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// PUT /api/v1/portal/dd/:token/responses — Auto-save batch of responses
//
// #PERF-N-PLUS-1: was a 2N round-trip loop (findFirst question +
// upsert per response). With 50 questions per auto-save that's ~100
// sequential DB round-trips on the supplier-portal hot path.
//
// Refactored to a fixed 4 sequential queries:
//   1. Pre-fetch all referenced questions in ONE inArray query.
//   2. Compute scores in memory (pure function over `options`).
//   3. ONE multi-row INSERT…ON CONFLICT DO UPDATE that drizzle
//      executes as a single round-trip.
//   4. Recompute progress (already 2 small queries) + UPDATE session.
//
// On 50-question save: ~100 RTTs → 4 RTTs (~25× speedup). The
// `ddr_session_question_idx` unique constraint
// (session_id, question_id) is the upsert target.

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

  if (body.data.responses.length === 0) {
    return Response.json({
      progressPercent: session.progressPercent ?? 0,
      savedCount: 0,
    });
  }

  // 1. Fetch every question referenced by this batch in one query.
  const questionIds = body.data.responses.map((r) => r.questionId);
  const questions = await db
    .select({
      id: questionnaireQuestion.id,
      questionType: questionnaireQuestion.questionType,
      options: questionnaireQuestion.options,
    })
    .from(questionnaireQuestion)
    .where(inArray(questionnaireQuestion.id, questionIds));

  const questionById = new Map<
    string,
    { questionType: string; options: unknown }
  >();
  for (const q of questions) {
    questionById.set(q.id, {
      questionType: q.questionType,
      options: q.options,
    });
  }

  // 2. Compute the score per response (the pure-function part).
  type RowValues = Parameters<typeof db.insert<typeof ddResponse>>[0] extends never
    ? never
    : unknown;
  const rowsToUpsert: Array<{
    sessionId: string;
    questionId: string;
    answerText: string | null;
    answerChoice: string[] | null;
    answerNumber: string | null;
    answerDate: string | null;
    answerBoolean: boolean | null;
    score: number | null;
  }> = [];
  void (null as unknown as RowValues);

  for (const resp of body.data.responses) {
    const question = questionById.get(resp.questionId);
    if (!question) continue;

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

    rowsToUpsert.push({
      sessionId: session.id,
      questionId: resp.questionId,
      answerText: resp.answerText ?? null,
      answerChoice: resp.answerChoice ?? null,
      answerNumber: resp.answerNumber?.toString() ?? null,
      answerDate: resp.answerDate ?? null,
      answerBoolean: resp.answerBoolean ?? null,
      score,
    });
  }

  // 3. ONE multi-row upsert. drizzle compiles this into a single
  // INSERT … VALUES (...), (...), ... ON CONFLICT DO UPDATE statement.
  if (rowsToUpsert.length > 0) {
    const now = new Date();
    await db
      .insert(ddResponse)
      .values(rowsToUpsert)
      .onConflictDoUpdate({
        target: [ddResponse.sessionId, ddResponse.questionId],
        set: {
          // Use Postgres's EXCLUDED pseudo-row so each conflicting row
          // picks up its OWN incoming values from the multi-row INSERT.
          // Referencing the table column directly (e.g.
          // `ddResponse.answerText`) would compile to a no-op
          // `answer_text = answer_text` and silently overwrite
          // nothing — a regression that's easy to miss in code review.
          answerText: sql`excluded.answer_text`,
          answerChoice: sql`excluded.answer_choice`,
          answerNumber: sql`excluded.answer_number`,
          answerDate: sql`excluded.answer_date`,
          answerBoolean: sql`excluded.answer_boolean`,
          score: sql`excluded.score`,
          updatedAt: now,
        },
      });
  }

  // 4. Recompute progress (same as before — 2 small queries).
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
    savedCount: rowsToUpsert.length,
  });
}
