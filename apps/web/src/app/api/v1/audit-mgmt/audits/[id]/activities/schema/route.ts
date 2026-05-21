// GET /api/v1/audit-mgmt/audits/[id]/activities/schema — Wave-24-D5
//
// #WAVE24-D5: Wave-24 QA repeatedly hit a 422 from POST
// /audit-mgmt/audits/{id}/activities sending `{name:'X',description:'Y'}`
// because the canonical schema requires `activityType` + `title` (the
// `type → activityType` alias only covers one of the two missing
// fields). Rather than dig through the route handler, callers can now
// fetch the schema directly: required fields, optional fields, an
// example body that's guaranteed to be accepted.
//
// Endpoint is auth-required but otherwise unrestricted within the org;
// it returns no audit-specific data so RLS only checks the audit row
// exists.

import { db, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  const [parent] = await db
    .select({ id: audit.id })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!parent) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      endpoint: `/api/v1/audit-mgmt/audits/${id}/activities`,
      method: "POST",
      contentType: "application/json",
      fields: {
        activityType: {
          type: "string",
          required: true,
          maxLength: 100,
          description:
            "Kind of activity logged. Common values: 'opening_meeting', 'fieldwork', 'interview', 'document_review', 'closing_meeting'. Alias accepted: `type`.",
        },
        title: {
          type: "string",
          required: true,
          maxLength: 500,
          description: "Short heading for the activity entry.",
        },
        description: {
          type: "string",
          required: false,
          description: "Free-form narrative.",
        },
        duration: {
          type: "integer",
          required: false,
          minimum: 1,
          description: "Duration in minutes.",
        },
        notes: {
          type: "string",
          required: false,
          description: "Internal notes — not exposed in external audit packs.",
        },
      },
      example: {
        activityType: "opening_meeting",
        title: "Kick-off with auditee",
        description:
          "Reviewed scope, agreed sampling plan, opened CAR tracker.",
        duration: 60,
        notes: "Auditee CFO + ISO 27001 lead joined.",
      },
    },
  });
});
