// BPM Overhaul Phase 7: Generate BPMN XML from a text description.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-12]
// 4000 Zeichen freier Text, `maxTokens: 4000`, kein Rate-Limit — laut
// Audit einer der beiden teuersten unlimitierten Endpunkte.
//
// `containsPersonalData` bleibt ein Client-Feld: es kann die Verarbeitung
// nur VERSCHÄRFEN (lokales Modell erzwingen). Seit S05-01 ist die
// Verschärfung fail-closed — ohne lokales Modell scheitert der Aufruf
// sichtbar mit 403, statt still in die Cloud zu gehen.

import {
  aiCompleteGoverned,
  buildTextToBpmnPrompt,
  bpmnGenerationSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../../ai/_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const schema = z.object({
  description: z.string().min(5).max(4000),
  locale: z.enum(["de", "en"]).optional(),
  containsPersonalData: z.boolean().optional(),
});

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId, {
    bucket: "bpmn-generate",
    capacity: 10,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await aiCompleteGoverned({
      feature: "bpm.generate_from_text",
      orgId: ctx.orgId,
      userId: ctx.userId,
      containsPersonalData: parsed.data.containsPersonalData,
      messages: buildTextToBpmnPrompt(
        parsed.data.description,
        parsed.data.locale ?? "de",
      ),
      maxTokens: 4000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: bpmnGenerationSchema,
    });

    // Sanity check: must contain a bpmn:definitions opening tag.
    if (!/<bpmn:definitions/i.test(result.data.bpmnXml)) {
      return Response.json(
        {
          error: "AI output is not valid BPMN XML",
          rawSample: result.data.bpmnXml.slice(0, 500),
        },
        { status: 422 },
      );
    }

    return aiJson(
      {
        bpmnXml: result.data.bpmnXml,
        summary: result.data.summary ?? null,
        activities: result.data.activities,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
});
