import { db, reportGenerationLog, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { generateReportSchema } from "@grc/shared";
import { reportGenerator } from "@grc/reporting";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// POST /api/v1/reports/generate — Generate report (async, returns job ID)
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = generateReportSchema.parse(await req.json());

  // Verify template exists and belongs to org
  const [template] = await db
    .select()
    .from(reportTemplate)
    .where(
      and(
        eq(reportTemplate.id, body.templateId),
        eq(reportTemplate.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  // Create generation log entry (queued)
  const [generationLog] = await db
    .insert(reportGenerationLog)
    .values({
      orgId: ctx.orgId,
      templateId: body.templateId,
      status: "queued",
      parametersJson: body.parameters,
      outputFormat: body.outputFormat,
      generatedBy: ctx.userId,
    })
    .returning();

  // Fire and forget — generation runs in background
  // The generator updates the log entry as it progresses
  reportGenerator
    .generate(
      generationLog.id,
      ctx.orgId,
      body.templateId,
      body.parameters as Record<string, unknown>,
      body.outputFormat,
    )
    .catch((error) => {
      log.error("[report-generate] job failed", {
        logId: generationLog.id,
        err: error,
      });
    });

  return Response.json({
    data: {
      logId: generationLog.id,
      status: "queued",
      templateName: template.name,
      outputFormat: body.outputFormat,
    },
  });
});
