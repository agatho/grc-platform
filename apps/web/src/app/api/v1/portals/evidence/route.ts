import { db, portalEvidenceUpload } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [ARCTOS-FULL-2026-08-31 / Restarbeiten] Die Route schrieb in
// `portal_evidence_upload` (Stakeholder-Portal), validierte aber gegen das
// TPRM-Lieferantenportal-Schema. Dessen Felder (`fileType`, `questionId`)
// existieren dort nicht, und `session_id`/`mime_type`/`storage_path` — alle
// NOT NULL — kamen nie an. Der POST konnte nie erfolgreich sein.
import { stakeholderPortalEvidenceUploadSchema } from "@grc/shared";

// GET /api/v1/portals/evidence?sessionId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId)
    return Response.json({ error: "sessionId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(portalEvidenceUpload)
    .where(
      and(
        eq(portalEvidenceUpload.sessionId, sessionId),
        eq(portalEvidenceUpload.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(portalEvidenceUpload.uploadedAt));

  return Response.json({ data: rows });
}

// POST /api/v1/portals/evidence
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = stakeholderPortalEvidenceUploadSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(portalEvidenceUpload)
      .values({
        orgId: ctx.orgId,
        ...body,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
