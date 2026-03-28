import { db, reportGenerationLog, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { generateReportSchema } from "@grc/shared";
import { reportGenerator } from "@grc/reporting";

// POST /api/v1/reports/generate — Generate report (async, returns job ID)
export async function POST(req: Request) {
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
  const [log] = await db
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
      log.id,
      ctx.orgId,
      body.templateId,
      body.parameters as Record<string, unknown>,
      body.outputFormat,
    )
    .catch((error) => {
      console.error(
        `[report-generate] Job ${log.id} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    });

  return Response.json({
    data: {
      logId: log.id,
      status: "queued",
      templateName: template.name,
      outputFormat: body.outputFormat,
    },
  });
}
