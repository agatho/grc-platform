import { db, importJob, importColumnMapping } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { confirmColumnMappingSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { getEntityDefinition } from "@/lib/import-export/entity-registry";

// GET /api/v1/import/:jobId/map-columns — Return auto-detected mapping
export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { jobId } = await params;

  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.orgId, ctx.orgId)));

  if (!job) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  const def = getEntityDefinition(job.entityType);
  const allFields = def ? [...def.requiredFields, ...def.optionalFields] : [];

  return Response.json({
    mapping: job.columnMapping,
    headers: job.rawHeaders,
    previewRows: job.rawPreviewRows,
    availableFields: allFields.map((f) => ({
      name: f.name,
      type: f.type,
      required: def?.requiredFields.some((r) => r.name === f.name) ?? false,
      aliases: f.aliases,
      enumValues: f.enumValues,
    })),
  });
}

// POST /api/v1/import/:jobId/map-columns — Confirm/adjust mapping
export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { jobId } = await params;

  const body = confirmColumnMappingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.orgId, ctx.orgId)));

  if (!job) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  if (!["mapping", "validated"].includes(job.status)) {
    return Response.json(
      {
        error: `Cannot update mapping in status '${job.status}'. Must be 'mapping' or 'validated'.`,
      },
      { status: 409 },
    );
  }

  // Validate that all required fields are mapped
  const def = getEntityDefinition(job.entityType);
  if (def) {
    const mappedFields = new Set(
      Object.values(body.data.mapping).filter(Boolean),
    );
    const missingRequired = def.requiredFields.filter(
      (f) => !mappedFields.has(f.name),
    );
    if (missingRequired.length > 0) {
      return Response.json(
        {
          error: "Required fields not mapped",
          missingFields: missingRequired.map((f) => f.name),
        },
        { status: 422 },
      );
    }
  }

  // Update job with confirmed mapping
  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(importJob)
      .set({
        columnMapping: body.data.mapping,
        status: "mapping",
      })
      .where(eq(importJob.id, jobId));
  });

  // Save mapping as template if requested
  if (body.data.saveMappingName) {
    const cleanMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.data.mapping)) {
      if (v) cleanMapping[k] = v;
    }

    await withAuditContext(ctx, async (tx) => {
      await tx.insert(importColumnMapping).values({
        orgId: ctx.orgId,
        entityType: job.entityType,
        name: body.data.saveMappingName!,
        mappingJson: cleanMapping,
        createdBy: ctx.userId,
      });
    });
  }

  return Response.json({ success: true, mapping: body.data.mapping });
}
