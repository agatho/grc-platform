import { db, eamBpmnElementPlacement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createBpmnPlacementSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/bpmn-placements — List placements for a process version
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "process_owner",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const processVersionId = url.searchParams.get("processVersionId");
  if (!processVersionId)
    return Response.json(
      { error: "processVersionId required" },
      { status: 400 },
    );

  const placements = await db
    .select()
    .from(eamBpmnElementPlacement)
    .where(
      and(
        eq(eamBpmnElementPlacement.processVersionId, processVersionId),
        eq(eamBpmnElementPlacement.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: placements });
}

// POST /api/v1/eam/bpmn-placements — Create placement (auto-syncs entity_reference)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createBpmnPlacementSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { positionX, positionY, ...rest } = parsed.data;
  const created = await db
    .insert(eamBpmnElementPlacement)
    .values({
      ...rest,
      orgId: ctx.orgId,
      // positionX/Y stored as numeric(…) in Postgres — Drizzle expects a string
      positionX: positionX !== undefined ? String(positionX) : undefined,
      positionY: positionY !== undefined ? String(positionY) : undefined,
    })
    .returning();

  // Auto-sync: would also create entity_reference linking process to EAM element
  return Response.json({ data: created[0] }, { status: 201 });
}

// DELETE /api/v1/eam/bpmn-placements — Remove placement (auto-cleans entity_reference)
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const placementId = url.searchParams.get("id");
  if (!placementId)
    return Response.json({ error: "id required" }, { status: 400 });

  const deleted = await db
    .delete(eamBpmnElementPlacement)
    .where(
      and(
        eq(eamBpmnElementPlacement.id, placementId),
        eq(eamBpmnElementPlacement.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!deleted.length)
    return Response.json({ error: "Placement not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
