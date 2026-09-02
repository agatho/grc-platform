import { db, cveAssetMatch } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { bulkCveMatchStatusSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/isms/cve/matches/bulk — Bulk update CVE match statuses
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bulkCveMatchStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updated = await tx
      .update(cveAssetMatch)
      .set({
        status: parsed.data.status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          eq(cveAssetMatch.orgId, ctx.orgId),
          inArray(cveAssetMatch.id, parsed.data.matchIds),
        ),
      )
      .returning({ id: cveAssetMatch.id });

    return { updated: updated.length };
  });

  return Response.json({ data: result });
});
