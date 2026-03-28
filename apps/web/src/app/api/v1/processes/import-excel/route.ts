import { db, process, processVersion } from "@grc/db";
import { convertExcelToBPMN } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/import-excel — Upload Excel, generate BPMN
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const processTitle = formData.get("title") as string | null;

  if (!file) {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  if (!processTitle?.trim()) {
    return Response.json({ error: "Process title is required" }, { status: 400 });
  }

  // Validate file type
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    return Response.json({ error: "File must be an Excel spreadsheet (.xlsx)" }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const result = await convertExcelToBPMN(buffer);

  if (result.errors.length > 0) {
    return Response.json(
      { error: "Import failed", errors: result.errors, warnings: result.warnings },
      { status: 422 },
    );
  }

  // Preview mode if ?preview=true
  const url = new URL(req.url);
  if (url.searchParams.get("preview") === "true") {
    return Response.json({
      data: {
        bpmnXml: result.bpmnXml,
        activityCount: result.activityCount,
        laneCount: result.laneCount,
        warnings: result.warnings,
      },
    });
  }

  // Create process + initial version
  const created = await withAuditContext(ctx, async (tx) => {
    const [newProcess] = await tx
      .insert(process)
      .values({
        orgId: ctx.orgId,
        name: processTitle.trim(),
        notation: "bpmn",
        status: "draft",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [newVersion] = await tx
      .insert(processVersion)
      .values({
        processId: newProcess.id,
        orgId: ctx.orgId,
        versionNumber: 1,
        bpmnXml: result.bpmnXml,
        createdBy: ctx.userId,
      })
      .returning();

    return { process: newProcess, version: newVersion };
  });

  return Response.json(
    {
      data: {
        processId: created.process.id,
        versionId: created.version.id,
        activityCount: result.activityCount,
        laneCount: result.laneCount,
        warnings: result.warnings,
      },
    },
    { status: 201 },
  );
}
