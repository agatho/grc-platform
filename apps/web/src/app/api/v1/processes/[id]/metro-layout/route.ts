import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/processes/:id/metro-layout — Update metro position
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const body = await req.json();

  if (typeof body.x !== "number" || typeof body.y !== "number") {
    return Response.json(
      { error: "x and y coordinates are required" },
      { status: 422 },
    );
  }

  // Verify process exists
  const result = await db.execute(
    sql`SELECT id FROM process WHERE id = ${processId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`,
  );

  if (result.length === 0) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const layoutJson = JSON.stringify({ x: body.x, y: body.y, lineColor: body.lineColor ?? null });

  await withAuditContext(ctx, async (tx) => {
    await tx.execute(
      sql`UPDATE process SET metro_layout = ${layoutJson}::jsonb,
                             updated_at = NOW(), updated_by = ${ctx.userId}
          WHERE id = ${processId} AND org_id = ${ctx.orgId}`,
    );
  });

  return Response.json({ data: { id: processId, metroLayout: layoutJson } });
}
