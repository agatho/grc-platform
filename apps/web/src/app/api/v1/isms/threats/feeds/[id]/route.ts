import { db, threatFeedSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateThreatFeedSourceSchema, checkOutboundUrl } from "@grc/shared";
import { assertUrlIsSafe } from "@grc/shared/lib/url-safety-server";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/isms/threats/feeds/[id]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateThreatFeedSourceSchema.parse(await req.json());

  // #S04-03: the SSRF guard must cover UPDATE as well — otherwise a feed
  // is created with a harmless URL and then repointed at
  // http://169.254.169.254/ a second later.
  if (body.feedUrl !== undefined) {
    const literal = checkOutboundUrl(body.feedUrl, { purpose: "threat feeds" });
    if (!literal.ok) {
      return Response.json(
        { error: `Feed URL rejected: ${literal.reason}` },
        { status: 422 },
      );
    }
    const resolved = await assertUrlIsSafe(body.feedUrl, {
      purpose: "threat feeds",
    });
    if (!resolved.ok) {
      return Response.json(
        { error: `Feed URL rejected: ${resolved.reason}` },
        { status: 422 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(threatFeedSource)
      .set(body)
      .where(
        and(eq(threatFeedSource.id, id), eq(threatFeedSource.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Feed source not found" }, { status: 404 });
  }

  return Response.json({ data: result });
});
// DELETE /api/v1/isms/threats/feeds/[id]
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(threatFeedSource)
      .where(
        and(eq(threatFeedSource.id, id), eq(threatFeedSource.orgId, ctx.orgId)),
      );
  });

  return Response.json({ success: true });
});
