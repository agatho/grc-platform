// BPM Overhaul Phase 8 D2: Bottleneck analysis from process_conformance_result.

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
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT
        pel.import_name,
        pel.imported_at,
        pcr.conformance_score,
        pcr.total_traces,
        pcr.conformant_traces,
        pcr.fitness_gaps,
        pcr.bottlenecks,
        pcr.rework_loops,
        pcr.computed_at
      FROM process_conformance_result pcr
      JOIN process_event_log pel ON pel.id = pcr.event_log_id
      WHERE pcr.process_id = ${id} AND pcr.org_id = ${ctx.orgId}
      ORDER BY pcr.computed_at DESC
      LIMIT 5
    `);
  });

  return Response.json({ data });
}
