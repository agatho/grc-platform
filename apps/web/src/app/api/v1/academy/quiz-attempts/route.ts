import { db, academyQuizAttempt, academyLesson } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { submitQuizAttemptSchema } from "@grc/shared";

// POST /api/v1/academy/quiz-attempts
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = submitQuizAttemptSchema.parse(await req.json());

  // Get lesson to check answers
  const [lesson] = await db.select().from(academyLesson)
    .where(and(eq(academyLesson.id, body.lessonId), eq(academyLesson.orgId, ctx.orgId)));
  if (!lesson) return Response.json({ error: "Lesson not found" }, { status: 404 });

  const questions = Array.isArray(lesson.quizQuestionsJson) ? lesson.quizQuestionsJson : [];
  let correct = 0;
  for (const answer of body.answersJson) {
    const q = questions[answer.questionIndex] as { correctIndex?: number } | undefined;
    if (q && q.correctIndex === answer.selectedIndex) correct++;
  }
  const scorePct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  // Count previous attempts
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(academyQuizAttempt)
    .where(and(
      eq(academyQuizAttempt.enrollmentId, body.enrollmentId),
      eq(academyQuizAttempt.lessonId, body.lessonId),
    ));

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(academyQuizAttempt).values({
      orgId: ctx.orgId,
      enrollmentId: body.enrollmentId,
      lessonId: body.lessonId,
      userId: ctx.userId,
      answersJson: body.answersJson,
      scorePct,
      passed: scorePct >= 80,
      attemptNumber: count + 1,
      durationSeconds: body.durationSeconds,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
