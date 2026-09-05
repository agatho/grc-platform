import { db, eamObjectSuggestion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/suggestions — Personalized suggestions (rule-based, no LLM needed)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const suggestions = await db
    .select()
    .from(eamObjectSuggestion)
    .where(
      and(
        eq(eamObjectSuggestion.userId, ctx.userId),
        eq(eamObjectSuggestion.orgId, ctx.orgId),
        eq(eamObjectSuggestion.dismissed, false),
      ),
    )
    .limit(50);

  return Response.json({ data: suggestions });
});
