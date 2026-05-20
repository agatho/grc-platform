// BPM Overhaul Phase 8 D2: Rework loop analysis from process_conformance_result.

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

  const rows = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT rework_loops, computed_at
      FROM process_conformance_result
      WHERE process_id = ${id} AND org_id = ${ctx.orgId}
      ORDER BY computed_at DESC
      LIMIT 1
    `);
  });

  const latest = (rows as any[])[0];
  return Response.json({
    data: {
      reworkLoops: latest?.rework_loops ?? [],
      computedAt: latest?.computed_at ?? null,
    },
  });
}
