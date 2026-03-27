import {
  db,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/policies/my-pending/:distId — Read document + quiz (if required)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ distId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { distId } = await params;

  // Get the distribution with document content and user's acknowledgment status
  const rows = await db.execute(sql`
    SELECT
      pd.id as "distributionId",
      pd.title as "distributionTitle",
      pd.document_id as "documentId",
      d.title as "documentTitle",
      pd.document_version as "documentVersion",
      COALESCE(dv.content, d.content) as "documentContent",
      pd.deadline,
      pd.is_mandatory as "isMandatory",
      pd.requires_quiz as "requiresQuiz",
      pd.quiz_pass_threshold as "quizPassThreshold",
      pd.quiz_questions as "quizQuestions",
      pa.id as "acknowledgmentId",
      pa.status,
      pa.acknowledged_at as "acknowledgedAt",
      pa.signature_hash as "signatureHash",
      pa.quiz_score as "quizScore",
      pa.quiz_passed as "quizPassed"
    FROM policy_acknowledgment pa
    INNER JOIN policy_distribution pd ON pd.id = pa.distribution_id
    INNER JOIN document d ON d.id = pd.document_id
    LEFT JOIN document_version dv ON dv.document_id = pd.document_id
      AND dv.version_number = pd.document_version
    WHERE pa.distribution_id = ${distId}
      AND pa.user_id = ${ctx.userId}
      AND pa.org_id = ${ctx.orgId}
  `);

  if (!rows.length) {
    return Response.json(
      { error: "Policy distribution not found or not assigned to you" },
      { status: 404 },
    );
  }

  const row = rows[0] as Record<string, unknown>;

  // Strip correct answers from quiz questions for pending users
  if (row.status !== "acknowledged" && row.quizQuestions) {
    const questions = row.quizQuestions as Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;
    row.quizQuestions = questions.map(({ question, options }) => ({
      question,
      options,
    }));
  }

  return Response.json({ data: row });
}
