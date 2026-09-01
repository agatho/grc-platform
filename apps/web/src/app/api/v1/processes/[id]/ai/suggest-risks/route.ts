// BPM Overhaul Phase 7: Suggest risks for a process.
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]

import { db, process, processStep } from "@grc/db";
import {
  aiCompleteGoverned,
  buildRiskSuggestionPrompt,
  riskSuggestionsSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { aiRateLimit, aiErrorResponse, aiJson } from "../../../../ai/_shared/ai-route";

const schema = z.object({
  locale: z.enum(["de", "en"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [existing] = await db
    .select({
      id: process.id,
      name: process.name,
      description: process.description,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  const steps = await db
    .select({ name: processStep.name })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));

  const existingRisks = (await db.execute(sql`
    SELECT r.title
    FROM risk r
    WHERE r.deleted_at IS NULL
      AND r.org_id = ${ctx.orgId}
      AND r.id IN (
        SELECT risk_id FROM process_risk WHERE process_id = ${id}
        UNION
        SELECT psr.risk_id FROM process_step_risk psr
        JOIN process_step ps ON ps.id = psr.process_step_id
        WHERE ps.process_id = ${id}
      )
  `)) as unknown as Array<{ title: string }>;

  try {
    const result = await aiCompleteGoverned({
      feature: "bpm.suggest_risks",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "process",
      entityId: existing.id,
      messages: buildRiskSuggestionPrompt({
        processName: existing.name,
        processDescription: existing.description,
        activityNames: steps.map((s) => s.name).filter(Boolean) as string[],
        existingRiskTitles: existingRisks.map((r) => r.title),
        locale,
      }),
      maxTokens: 1500,
      temperature: 0.5,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: riskSuggestionsSchema,
    });

    return aiJson(
      {
        suggestions: result.data.risks,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
