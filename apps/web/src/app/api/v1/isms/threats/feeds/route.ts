import { db, threatFeedSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createThreatFeedSourceSchema, checkOutboundUrl } from "@grc/shared";
import { assertUrlIsSafe } from "@grc/shared/lib/url-safety-server";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/threats/feeds — List feed sources
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select()
    .from(threatFeedSource)
    .where(eq(threatFeedSource.orgId, ctx.orgId))
    .orderBy(desc(threatFeedSource.createdAt));

  return Response.json({ data: rows });
});
// POST /api/v1/isms/threats/feeds — Add feed source
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createThreatFeedSourceSchema.parse(await req.json());

  // #S04-03 (ARCTOS-FULL-2026-08-31, High) — SSRF. `feedUrl` was only
  // `z.string().url()`-validated and was then fetched periodically by the
  // worker (superuser, private network). Refuse private/reserved targets
  // at registration time; `threat-feed-sync.ts` re-checks at fetch time
  // (rows can also arrive via seeds/imports) and validates every redirect
  // hop. The literal check runs first so an obviously bad URL never costs
  // a DNS round trip.
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

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(threatFeedSource)
      .values({
        orgId: ctx.orgId,
        name: body.name,
        feedUrl: body.feedUrl,
        feedType: body.feedType,
        isActive: body.isActive,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
