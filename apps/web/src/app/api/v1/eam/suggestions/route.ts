import { db, eamObjectSuggestion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/suggestions — Personalized suggestions (rule-based, no LLM needed)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const suggestions = await db.select().from(eamObjectSuggestion)
    .where(and(
      eq(eamObjectSuggestion.userId, ctx.userId),
      eq(eamObjectSuggestion.orgId, ctx.orgId),
      eq(eamObjectSuggestion.dismissed, false),
    ))
    .limit(50);

  return Response.json({ data: suggestions });
}
