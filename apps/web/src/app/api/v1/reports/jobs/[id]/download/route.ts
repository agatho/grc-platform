import { db, reportGenerationLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import * as fs from "fs/promises";
import * as path from "path";

// GET /api/v1/reports/jobs/[id]/download — Download generated file
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [log] = await db
    .select()
    .from(reportGenerationLog)
    .where(
      and(
        eq(reportGenerationLog.id, id),
        eq(reportGenerationLog.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!log) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  if (log.status !== "completed" || !log.filePath) {
    return Response.json(
      {
        error:
          log.status === "failed"
            ? `Generation failed: ${log.error}`
            : "Report not yet generated",
      },
      { status: 400 },
    );
  }

  try {
    const fileBuffer = await fs.readFile(log.filePath);
    const fileName = `report_${id}.${log.outputFormat}`;
    const contentType =
      log.outputFormat === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch {
    return Response.json(
      { error: "Generated file not found on disk" },
      { status: 404 },
    );
  }
}
