import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { reportGenerator } from "@grc/reporting";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { problem, getRequestId } from "@/lib/api-errors";
import { log } from "@/lib/logger";

const previewSchema = z.object({
  templateId: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

// POST /api/v1/reports/preview — Generate HTML preview
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = previewSchema.parse(await req.json());

  try {
    const html = await reportGenerator.preview(
      ctx.orgId,
      body.templateId,
      body.parameters as Record<string, unknown>,
    );
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    // [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] Hier stand
    // `error: error.message`. `reportGenerator.preview` liest Vorlage,
    // Bindungen und Nutzdaten aus der Datenbank; was der Aufrufer bekam, war
    // deshalb im Fehlerfall der Treibertext — gemessen am 2026-09-04 etwa
    // `invalid input value for enum finding_status: "open"` oder
    // `Key (org_id)=(…) is not present in table "organization".` Der volle
    // Text steht im Log, die Antwort trägt die `requestId`.
    log.error("[reports/preview] preview generation failed", {
      templateId: body.templateId,
      error: error instanceof Error ? error.message : String(error),
    });
    return problem.internal({
      requestId: getRequestId(req),
      instance: req.url,
      detail:
        "The preview could not be generated. The full error has been logged server-side; include the requestId when reporting.",
    });
  }
});
