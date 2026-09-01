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

/** Single definition of the final status so the checksum and the stored
 *  row can never disagree (#S06-02). */
function finalStatusForChecksum(
  requiresQuiz: boolean | null | undefined,
  quizPassed: boolean | null | undefined,
): "failed_quiz" | "acknowledged" {
  return requiresQuiz && !quizPassed ? "failed_quiz" : "acknowledged";
}

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
      {
        error: `Minimum reading time of ${MIN_READ_DURATION_SECONDS} seconds required`,
      },
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
        {
          error: `Expected ${questions.length} quiz responses, got ${body.data.quizResponses.length}`,
        },
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
          {
            error: `Invalid selectedOptionIndex for question ${response.questionIndex}`,
          },
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

  // ── #S06-02 (ARCTOS-FULL-2026-08-31, Medium) ──────────────────────
  // The old expression hashed COALESCE(dv.content, d.content, '') — the
  // TEXT column, never the attached file. For a policy distributed as a
  // PDF (the DMS default: the content lives in file_path and `content`
  // is NULL) it fell through to digest(''), the CONSTANT
  // e3b0c442…b855. The value the UI called "Digitale Signatur … dient
  // als Nachweis" then demonstrably attested nothing about the document.
  //
  // The file hash is now the primary source, the text column the
  // fallback, and `document_hash_source` records which one was used —
  // so "no content was bound at all" stays distinguishable from
  // "content was bound" instead of both producing the same string.
  const docHashResult = await db.execute(sql`
    SELECT
      COALESCE(dv.file_sha256, d.file_sha256)                        AS file_sha,
      encode(digest(COALESCE(dv.content, ''), 'sha256'), 'hex')      AS version_content_sha,
      encode(digest(COALESCE(d.content, ''), 'sha256'), 'hex')       AS doc_content_sha,
      (dv.content IS NOT NULL AND dv.content <> '')                  AS has_version_content,
      (d.content  IS NOT NULL AND d.content  <> '')                  AS has_doc_content
    FROM document d
    LEFT JOIN document_version dv ON dv.document_id = d.id
      AND dv.version_number = ${dist.documentVersion}
    WHERE d.id = ${dist.documentId}
  `);
  const hashRow = docHashResult[0] as
    | {
        file_sha: string | null;
        version_content_sha: string;
        doc_content_sha: string;
        has_version_content: boolean;
        has_doc_content: boolean;
      }
    | undefined;

  let documentHash = "no-content";
  let documentHashSource:
    "file" | "version_content" | "document_content" | "none" = "none";
  if (hashRow?.file_sha) {
    documentHash = hashRow.file_sha;
    documentHashSource = "file";
  } else if (hashRow?.has_version_content) {
    documentHash = hashRow.version_content_sha;
    documentHashSource = "version_content";
  } else if (hashRow?.has_doc_content) {
    documentHash = hashRow.doc_content_sha;
    documentHashSource = "document_content";
  }

  const now = new Date();

  // Extract IP + User-Agent
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? "unknown";

  // #S06-02 — acknowledgment CHECKSUM, hash version 2.
  //
  // This is deliberately NOT called a signature any more (see the i18n
  // change and migration 0423): it is an unkeyed SHA-512 over values
  // that all live in the same row, with no key material, no
  // certificate and no chaining. Anyone with write access to
  // policy_acknowledgment can fabricate or back-date a confirmation and
  // recompute the matching value in one line of code. What it can do —
  // and now actually does — is bind the evidence-bearing fields
  // (status, quiz result, read duration, IP, user agent) that used to
  // sit outside it, so they cannot be swapped without the checksum
  // falling apart. The real tamper evidence is the audit trigger on
  // this table, whose chain is anchored (ADR-011).
  const checksumInput = [
    "v2",
    ctx.userId,
    distId,
    now.toISOString(),
    documentHashSource,
    documentHash,
    finalStatusForChecksum(dist.requiresQuiz, quizPassed),
    String(quizScore ?? ""),
    String(quizPassed ?? ""),
    String(body.data.readDurationSeconds ?? ""),
    ipAddress,
    userAgent,
  ].join("\u001f");
  const signatureHash = createHash("sha512")
    .update(checksumInput)
    .digest("hex");

  // Determine final status (same rule as finalStatusForChecksum above).
  const finalStatus = finalStatusForChecksum(dist.requiresQuiz, quizPassed);

  const result = await withAuditContext(ctx, async (tx) => {
    // Update acknowledgment
    const [updated] = await tx
      .update(policyAcknowledgment)
      .set({
        status: finalStatus,
        acknowledgedAt: now,
        signatureHash,
        signatureHashVersion: 2,
        documentSha256: documentHashSource === "none" ? null : documentHash,
        documentHashSource,
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
