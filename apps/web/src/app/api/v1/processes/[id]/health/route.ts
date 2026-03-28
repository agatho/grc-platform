import { db } from "@grc/db";
import { updateProcessHealthSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/processes/:id/health — Set traffic light status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const body = updateProcessHealthSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
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

  // Update health (column from migration 877)
  await withAuditContext(ctx, async (tx) => {
    await tx.execute(
      sql`UPDATE process SET process_health = ${body.data.processHealth},
                             updated_at = NOW(), updated_by = ${ctx.userId}
          WHERE id = ${processId} AND org_id = ${ctx.orgId}`,
    );
  });

  return Response.json({ data: { id: processId, processHealth: body.data.processHealth } });
}
