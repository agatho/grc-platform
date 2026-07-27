// W21-DMS-MULTISIGN-01: "My pending signatures" — every open signer
// slot of the current user across all pending signature requests.
// Pattern: /api/v1/policies/my-pending (raw SQL, signer-centric view).
//
// `isMyTurn` is false only for sequential requests where an earlier
// signer is still pending — the UI greys those out.

import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

async function GET__ctx(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db.execute(sql`
    SELECT
      ds.id            AS "signatureId",
      ds.request_id    AS "requestId",
      ds.sign_order    AS "signOrder",
      dsr.title        AS "requestTitle",
      dsr.message,
      dsr.sequential,
      dsr.due_date     AS "dueDate",
      dsr.created_at   AS "requestedAt",
      dsr.document_id  AS "documentId",
      d.title          AS "documentTitle",
      dv.version_label AS "versionLabel",
      u.name           AS "requestedByName",
      NOT (
        dsr.sequential AND EXISTS (
          SELECT 1 FROM document_signature earlier
          WHERE earlier.request_id = ds.request_id
            AND earlier.sign_order < ds.sign_order
            AND earlier.status = 'pending'
        )
      ) AS "isMyTurn"
    FROM document_signature ds
    INNER JOIN document_signature_request dsr ON dsr.id = ds.request_id
    INNER JOIN document d ON d.id = dsr.document_id
    LEFT JOIN document_version dv ON dv.id = dsr.version_id
    LEFT JOIN "user" u ON u.id = dsr.created_by
    WHERE ds.signer_user_id = ${ctx.userId}
      AND ds.org_id = ${ctx.orgId}
      AND ds.status = 'pending'
      AND dsr.status = 'pending'
    ORDER BY dsr.due_date ASC NULLS LAST, dsr.created_at ASC
  `);

  return Response.json({ data: rows });
}

// #SEC-F01b-RUN: wrap handlers so the request-scoped RLS context frame
// (opened by withErrorHandler, mutated by withAuth) is present around the bare
// db.* reads above — otherwise they run context-less under grc_app and RLS
// filters/faults. Also converts prior empty-body 500s to structured problem+json.
export const GET = withErrorHandler(GET__ctx);
