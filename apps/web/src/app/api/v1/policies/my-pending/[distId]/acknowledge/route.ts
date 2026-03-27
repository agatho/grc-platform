import { createHash } from "crypto";
import {
  db,
  policyDistribution,
  policyAcknowledgment,
  policyQuizResponse,
} from "@grc/db";
import { acknowledgeSchema, MIN_READ_DURATION_SECONDS } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/policies/my-pending/:distId/acknowledge — Submit acknowledgment + quiz answers
export async function POST(
  req: Request,
  { params }: { params: Promise<{ distId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { distId } = await params;

  const body = acknowledgeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get acknowledgment record
  const [ack] = await db
    .select()
    .from(policyAcknowledgment)
    .where(
      and(
        eq(policyAcknowledgment.distributionId, distId),
        eq(policyAcknowledgment.userId, ctx.userId),
        eq(policyAcknowledgment.orgId, ctx.orgId),
      ),
    );

  if (!ack) {
    return Response.json(
      { error: "Policy distribution not found or not assigned to you" },
      { status: 404 },
    );
  }

  if (ack.status === "acknowledged") {
    return Response.json(
      { error: "You have already acknowledged this policy" },
      { status: 409 },
    );
  }

  // Anti-gaming: minimum reading time
  if (body.data.readDurationSeconds < MIN_READ_DURATION_SECONDS) {
    return Response.json(
      { error: `Minimum reading time of ${MIN_READ_DURATION_SECONDS} seconds required` },
      { status: 422 },
    );
  }

  // Get distribution for quiz validation
  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(eq(policyDistribution.id, distId));

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  if (dist.status !== "active") {
    return Response.json(
      { error: "This distribution is no longer active" },
      { status: 409 },
    );
  }

  // Quiz scoring
  let quizScore: number | undefined;
  let quizPassed: boolean | undefined;
  const quizResponseRecords: Array<{
    questionIndex: number;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }> = [];

  if (dist.requiresQuiz) {
    const questions = dist.quizQuestions as Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;

    if (!body.data.quizResponses || body.data.quizResponses.length === 0) {
      return Response.json(
        { error: "Quiz responses are required for this policy" },
        { status: 422 },
      );
    }

    if (body.data.quizResponses.length !== questions.length) {
      return Response.json(
        { error: `Expected ${questions.length} quiz responses, got ${body.data.quizResponses.length}` },
        { status: 422 },
      );
    }

    let correctCount = 0;
    for (const response of body.data.quizResponses) {
      if (response.questionIndex >= questions.length) {
        return Response.json(
          { error: `Invalid questionIndex: ${response.questionIndex}` },
          { status: 422 },
        );
      }
      const question = questions[response.questionIndex];
      if (response.selectedOptionIndex >= question.options.length) {
        return Response.json(
          { error: `Invalid selectedOptionIndex for question ${response.questionIndex}` },
          { status: 422 },
        );
      }
      const isCorrect = response.selectedOptionIndex === question.correctIndex;
      if (isCorrect) correctCount++;

      quizResponseRecords.push({
        questionIndex: response.questionIndex,
        selectedOptionIndex: response.selectedOptionIndex,
        isCorrect,
      });
    }

    quizScore = Math.round((correctCount / questions.length) * 100);
    quizPassed = quizScore >= (dist.quizPassThreshold ?? 80);
  }

  // Get document hash for signature
  const docHashResult = await db.execute(sql`
    SELECT COALESCE(
      encode(digest(COALESCE(dv.content, d.content, ''), 'sha256'), 'hex'),
      'no-content'
    ) as hash
    FROM document d
    LEFT JOIN document_version dv ON dv.document_id = d.id
      AND dv.version_number = ${dist.documentVersion}
    WHERE d.id = ${dist.documentId}
  `);
  const documentHash = (docHashResult[0] as { hash: string })?.hash ?? "no-content";

  const now = new Date();

  // Extract IP + User-Agent
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? "unknown";

  // Generate signature hash: SHA-512(userId + distributionId + timestamp + documentHash)
  const signatureHash = createHash("sha512")
    .update(`${ctx.userId}:${distId}:${now.toISOString()}:${documentHash}`)
    .digest("hex");

  // Determine final status
  const finalStatus = dist.requiresQuiz && !quizPassed ? "failed_quiz" : "acknowledged";

  const result = await withAuditContext(ctx, async (tx) => {
    // Update acknowledgment
    const [updated] = await tx
      .update(policyAcknowledgment)
      .set({
        status: finalStatus,
        acknowledgedAt: now,
        signatureHash,
        quizScore,
        quizPassed,
        readDurationSeconds: body.data.readDurationSeconds,
        ipAddress,
        userAgent,
        updatedAt: now,
      })
      .where(
        and(
          eq(policyAcknowledgment.distributionId, distId),
          eq(policyAcknowledgment.userId, ctx.userId),
          eq(policyAcknowledgment.orgId, ctx.orgId),
        ),
      )
      .returning();

    // Store quiz responses if applicable
    if (quizResponseRecords.length > 0 && updated) {
      await tx.insert(policyQuizResponse).values(
        quizResponseRecords.map((r) => ({
          orgId: ctx.orgId,
          acknowledgmentId: updated.id,
          questionIndex: r.questionIndex,
          selectedOptionIndex: r.selectedOptionIndex,
          isCorrect: r.isCorrect,
          answeredAt: now,
        })),
      );
    }

    return updated;
  });

  return Response.json({
    data: {
      id: result.id,
      status: result.status,
      acknowledgedAt: result.acknowledgedAt,
      signatureHash: result.signatureHash,
      quizScore: result.quizScore,
      quizPassed: result.quizPassed,
    },
  });
}
