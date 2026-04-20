import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { reportGenerator } from "@grc/reporting";
import { z } from "zod";

const previewSchema = z.object({
  templateId: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

// POST /api/v1/reports/preview — Generate HTML preview
export async function POST(req: Request) {
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
}
