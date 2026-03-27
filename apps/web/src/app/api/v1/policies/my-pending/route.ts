import {
  db,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/policies/my-pending — Policies I need to acknowledge
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status"); // pending | acknowledged | overdue | failed_quiz

  const rows = await db.execute(sql`
    SELECT
      pd.id as "distributionId",
      pd.title as "distributionTitle",
      pd.document_id as "documentId",
      d.title as "documentTitle",
      pd.document_version as "documentVersion",
      pd.deadline,
      pd.is_mandatory as "isMandatory",
      pd.requires_quiz as "requiresQuiz",
      pd.quiz_pass_threshold as "quizPassThreshold",
      pa.status,
      pa.acknowledged_at as "acknowledgedAt",
      pa.signature_hash as "signatureHash",
      pa.quiz_score as "quizScore",
      pa.quiz_passed as "quizPassed"
    FROM policy_acknowledgment pa
    INNER JOIN policy_distribution pd ON pd.id = pa.distribution_id
    INNER JOIN document d ON d.id = pd.document_id
    WHERE pa.user_id = ${ctx.userId}
      AND pa.org_id = ${ctx.orgId}
      AND pd.status = 'active'
      ${statusFilter ? sql`AND pa.status = ${statusFilter}` : sql``}
    ORDER BY
      CASE pa.status
        WHEN 'overdue' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'failed_quiz' THEN 3
        WHEN 'acknowledged' THEN 4
      END,
      pd.deadline ASC
  `);

  return Response.json({ data: rows });
}
