// TPRM Overhaul: AI due-diligence question drafter.
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]

import { db, vendor } from "@grc/db";
import {
  aiCompleteGoverned,
  buildDdQuestionDraftPrompt,
  ddQuestionsSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../../../../ai/_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "vendor_manager", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [v] = await db
    .select()
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  try {
    const result = await aiCompleteGoverned({
      feature: "tprm.draft_dd_questions",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "vendor",
      entityId: v.id,
      messages: buildDdQuestionDraftPrompt({
        vendorName: v.name,
        category: v.category ?? "other",
        tier: v.tier ?? "standard",
        doraCriticalIct: v.doraCriticalIct,
        lksgTier1: v.lksgTier1,
        locale,
      }),
      maxTokens: 2500,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: ddQuestionsSchema,
    });

    return aiJson(
      {
        questions: result.data.questions,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
});
