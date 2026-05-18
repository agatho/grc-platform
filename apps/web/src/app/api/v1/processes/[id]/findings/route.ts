// BPM Overhaul Phase 2: List all findings tied to a process (direct or via step/control).

import {
  db,
  process,
  processStep,
  processStepControl,
  processControl,
  finding,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const includeIndirect = url.searchParams.get("includeIndirect") !== "false";

  const findings = await db.execute(sql`
    SELECT DISTINCT
      f.id, f.title, f.severity, f.status, f.source,
      f.owner_id, f.remediation_due_date, f.created_at,
      f.process_id, f.process_step_id, f.control_id, f.audit_id,
      CASE
        WHEN f.process_id = ${id} THEN 'direct_process'
        WHEN f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${id}) THEN 'direct_step'
        WHEN ${includeIndirect} AND f.control_id IN (
          SELECT control_id FROM process_control WHERE process_id = ${id}
          UNION
          SELECT psc.control_id FROM process_step_control psc
          JOIN process_step ps ON ps.id = psc.process_step_id
          WHERE ps.process_id = ${id}
        ) THEN 'indirect_control'
        ELSE 'unknown'
      END AS link_via
    FROM finding f
    WHERE f.org_id = ${ctx.orgId}
      AND f.deleted_at IS NULL
      AND (
        f.process_id = ${id}
        OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${id})
        OR (${includeIndirect} AND f.control_id IN (
          SELECT control_id FROM process_control WHERE process_id = ${id}
          UNION
          SELECT psc.control_id FROM process_step_control psc
          JOIN process_step ps ON ps.id = psc.process_step_id
          WHERE ps.process_id = ${id}
        ))
      )
    ORDER BY
      CASE f.severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END,
      f.created_at DESC
  `);

  return Response.json({ data: findings });
}
