// BPM Overhaul Phase 6: Audit trail for a process — combines audit_log entries
// across process, process_version, process_sign_off, and step links.

import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 1000);

  const trail = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT al.id, al.entity_type, al.entity_id, al.action, al.action_detail,
             al.user_id, al.user_email, al.user_name, al.created_at,
             al.metadata, al.changes
      FROM audit_log al
      WHERE al.org_id = ${ctx.orgId}
        AND (
          (al.entity_type = 'process' AND al.entity_id = ${id})
          OR (al.entity_type = 'process_version' AND al.entity_id IN (
            SELECT id FROM process_version WHERE process_id = ${id}
          ))
          OR (al.entity_type = 'process_step' AND al.entity_id IN (
            SELECT id FROM process_step WHERE process_id = ${id}
          ))
          OR (al.entity_type = 'process_sign_off' AND al.entity_id IN (
            SELECT id FROM process_sign_off WHERE process_id = ${id}
          ))
          OR (al.entity_type IN ('process_risk', 'process_step_risk', 'process_control', 'process_step_control', 'process_document', 'process_asset', 'process_ropa_profile', 'process_framework_mapping') AND
              (al.metadata->>'process_id' = ${id}::text OR al.entity_id IN (
                SELECT id FROM process_risk WHERE process_id = ${id}
                UNION ALL
                SELECT id FROM process_control WHERE process_id = ${id}
                UNION ALL
                SELECT id FROM process_document WHERE process_id = ${id}
                UNION ALL
                SELECT id FROM process_asset WHERE process_id = ${id}
              )))
        )
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `);
  });

  return Response.json({ data: trail, count: trail.length });
}
