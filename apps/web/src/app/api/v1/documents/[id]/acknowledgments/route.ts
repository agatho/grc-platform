import { db, document, acknowledgment, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/documents/:id/acknowledgments — List all acknowledgments
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [doc] = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const acks = await db
    .select({
      id: acknowledgment.id,
      userId: acknowledgment.userId,
      userName: user.name,
      userEmail: user.email,
      versionAcknowledged: acknowledgment.versionAcknowledged,
      acknowledgedAt: acknowledgment.acknowledgedAt,
    })
    .from(acknowledgment)
    .innerJoin(user, eq(acknowledgment.userId, user.id))
    .where(
      and(
        eq(acknowledgment.documentId, id),
        eq(acknowledgment.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: acks });
});
