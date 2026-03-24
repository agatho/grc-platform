import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/notifications/:id/read — Mark as read (all roles)
export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const updated = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE notification
      SET is_read = true, updated_by = ${ctx.userId}
      WHERE id = ${id}
        AND user_id = ${ctx.userId}
        AND org_id = ${ctx.orgId}
        AND deleted_at IS NULL
      RETURNING id, is_read
    `);
    return rows[0];
  });

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
}
