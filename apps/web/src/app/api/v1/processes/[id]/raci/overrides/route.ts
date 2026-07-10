import { db, processVersion, processRaciOverride } from "@grc/db";
import { raciOverrideSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/processes/:id/raci/overrides — Update RACI cell override
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const body = raciOverrideSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get latest version
  const [latestVersion] = await db
    .select({ id: processVersion.id })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion) {
    return Response.json(
      { error: "No process version found" },
      { status: 404 },
    );
  }

  const override = await withAuditContext(ctx, async (tx) => {
    // Upsert override
    const [result] = await tx
      .insert(processRaciOverride)
      .values({
        processVersionId: latestVersion.id,
        orgId: ctx.orgId,
        activityBpmnId: body.data.activityBpmnId,
        participantBpmnId: body.data.participantBpmnId,
        raciRole: body.data.raciRole,
        overriddenBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          processRaciOverride.processVersionId,
          processRaciOverride.activityBpmnId,
          processRaciOverride.participantBpmnId,
        ],
        set: {
          raciRole: body.data.raciRole,
          overriddenBy: ctx.userId,
          createdAt: new Date(),
        },
      })
      .returning();
    return result;
  });

  return Response.json({ data: override });
}

// GET /api/v1/processes/:id/raci/overrides?activityBpmnId=... — list
// overrides of the latest version (B3.1: used by the properties panel to
// hydrate Consulted/Informed multi-selects).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const url = new URL(req.url);
  const activityBpmnId = url.searchParams.get("activityBpmnId");

  const [latestVersion] = await db
    .select({ id: processVersion.id })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion) {
    return Response.json({ data: [] });
  }

  const conditions = [
    eq(processRaciOverride.processVersionId, latestVersion.id),
    eq(processRaciOverride.orgId, ctx.orgId),
  ];
  if (activityBpmnId) {
    conditions.push(eq(processRaciOverride.activityBpmnId, activityBpmnId));
  }

  const rows = await db
    .select({
      id: processRaciOverride.id,
      activityBpmnId: processRaciOverride.activityBpmnId,
      participantBpmnId: processRaciOverride.participantBpmnId,
      raciRole: processRaciOverride.raciRole,
      createdAt: processRaciOverride.createdAt,
    })
    .from(processRaciOverride)
    .where(and(...conditions));

  return Response.json({ data: rows });
}

// DELETE /api/v1/processes/:id/raci/overrides?activityBpmnId=...&participantBpmnId=...
// Removes a single override cell of the latest version (B3.1: unselecting
// a Consulted/Informed role).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const url = new URL(req.url);
  const activityBpmnId = url.searchParams.get("activityBpmnId");
  const participantBpmnId = url.searchParams.get("participantBpmnId");
  if (!activityBpmnId || !participantBpmnId) {
    return Response.json(
      { error: "activityBpmnId + participantBpmnId query params required" },
      { status: 422 },
    );
  }

  const [latestVersion] = await db
    .select({ id: processVersion.id })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion) {
    return Response.json(
      { error: "No process version found" },
      { status: 404 },
    );
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const rows = await tx
      .delete(processRaciOverride)
      .where(
        and(
          eq(processRaciOverride.processVersionId, latestVersion.id),
          eq(processRaciOverride.orgId, ctx.orgId),
          eq(processRaciOverride.activityBpmnId, activityBpmnId),
          eq(processRaciOverride.participantBpmnId, participantBpmnId),
        ),
      )
      .returning();
    return rows;
  });

  return Response.json({ data: { deleted: deleted.length } });
}
