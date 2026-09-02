import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { reportGenerator } from "@grc/reporting";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

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
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Preview generation failed",
      },
      { status: 500 },
    );
  }
});
