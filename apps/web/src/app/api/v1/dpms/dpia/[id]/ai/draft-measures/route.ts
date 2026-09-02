// DPMS Overhaul: AI-draft mitigation measures for identified DPIA risks.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-06, S05-09, S05-10, S05-12]
// Zweiter Pfad aus S05-01 — siehe den Kommentar in
// dpms/ropa/[id]/ai/draft-fields/route.ts.

import { db, dpia, dpiaRisk } from "@grc/db";
import {
  aiCompleteGoverned,
  buildDpiaMeasureDraftPrompt,
  dpiaMeasuresSchema,
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

interface DpiaRiskRow {
  title: string;
  description: string | null;
  inherentRiskScore: number | null;
}

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [d] = await db
    .select()
    .from(dpia)
    .where(
      and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)),
    );
  if (!d) return Response.json({ error: "DPIA not found" }, { status: 404 });

  const risks = (await db
    .select()
    .from(dpiaRisk)
    .where(eq(dpiaRisk.dpiaId, id))) as unknown as DpiaRiskRow[];

  if (risks.length === 0) {
    return Response.json({
      data: {
        measures: [],
        note: "No identified risks to draft measures for.",
      },
    });
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  try {
    const result = await aiCompleteGoverned({
      feature: "dpms.dpia_draft_measures",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "dpia",
      entityId: d.id,
      containsPersonalData: true,
      messages: buildDpiaMeasureDraftPrompt({
        dpiaTitle: d.title,
        processingDescription: d.processingDescription,
        identifiedRisks: risks.map((r) => ({
          title: r.title,
          description: r.description,
          inherentRiskScore: r.inherentRiskScore ?? null,
        })),
        locale,
      }),
      maxTokens: 2000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: dpiaMeasuresSchema,
    });

    return aiJson(
      {
        measures: result.data.measures,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
});
